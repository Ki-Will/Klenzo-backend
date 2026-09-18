import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_CATALOG, ROLE_DEFINITIONS } from './permissions.catalog';
import { AdminRoleCode } from '@prisma/client';
import { RedisService } from '../../redis/redis.service';
import * as crypto from 'crypto';

const SYSTEM_ROLE_CODES: string[] = ROLE_DEFINITIONS.map((r) => r.code);
const PERMISSION_CACHE_PREFIX = 'rbac:perms:';
const PERMISSION_CACHE_TTL = 300; // 5 minutes

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Seed (Idempotent) ──────────────────────────────────────────────────

  async seed(actorId?: string) {
    this.logger.log('Seeding RBAC permissions and roles...');

    // 1. Upsert all permissions
    for (const perm of PERMISSION_CATALOG) {
      await this.prisma.permission.upsert({
        where: { resource_action: { resource: perm.resource, action: perm.action } },
        update: { description: perm.description },
        create: {
          resource: perm.resource,
          action: perm.action,
          description: perm.description,
        },
      });
    }
    this.logger.log(`  ✔ ${PERMISSION_CATALOG.length} permissions seeded`);

    // 2. Upsert roles and assign permissions
    for (const roleDef of ROLE_DEFINITIONS) {
      const role = await this.prisma.adminRole.upsert({
        where: { code: roleDef.code as AdminRoleCode },
        update: { name: roleDef.name, description: roleDef.description },
        create: {
          code: roleDef.code as AdminRoleCode,
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
          isActive: true,
        },
      });

      const permissionPairs = roleDef.permissions.map((p) => {
        const [resource, action] = p.split('.');
        return { resource, action };
      });

      const permissions = await this.prisma.permission.findMany({
        where: {
          OR: permissionPairs.map((p) => ({ resource: p.resource, action: p.action })),
        },
      });

      await this.prisma.adminRolePermission.deleteMany({ where: { roleId: role.id } });
      await this.prisma.adminRolePermission.createMany({
        data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });

      this.logger.log(`  ✔ Role ${roleDef.name}: ${permissions.length} permissions`);
    }

    // Audit the seed event
    if (actorId) {
      await this.writeAuditEvent(actorId, 'RBAC_SEED_EXECUTED', null, null, {
        permissionCount: PERMISSION_CATALOG.length,
        roleCount: ROLE_DEFINITIONS.length,
      });
    }

    this.logger.log('RBAC seed complete');
  }

  // ─── Roles CRUD ─────────────────────────────────────────────────────────

  async getAllRoles() {
    return this.prisma.adminRole.findMany({
      include: {
        _count: { select: { permissions: true, users: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async getRoleById(id: string) {
    const role = await this.prisma.adminRole.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        users: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async createRole(
    dto: { code: string; name: string; description?: string },
    actorId: string,
  ) {
    // System roles cannot be created manually
    if (SYSTEM_ROLE_CODES.includes(dto.code)) {
      throw new BadRequestException(`Cannot manually create system role: ${dto.code}`);
    }

    const role = await this.prisma.adminRole.create({
      data: {
        code: dto.code as AdminRoleCode,
        name: dto.name,
        description: dto.description,
        isSystem: false,
        isActive: true,
      },
    });

    await this.writeAuditEvent(actorId, 'ROLE_CREATED', 'role', role.id, {
      code: role.code,
      name: role.name,
    });

    return role;
  }

  async updateRole(
    id: string,
    dto: { name?: string; description?: string; isActive?: boolean },
    actorId: string,
  ) {
    const role = await this.prisma.adminRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    // Prevent disabling system roles
    if (role.isSystem && dto.isActive === false) {
      throw new BadRequestException('Cannot disable system roles');
    }

    const beforeState = { name: role.name, description: role.description, isActive: role.isActive };

    const updated = await this.prisma.adminRole.update({
      where: { id },
      data: dto,
    });

    await this.writeAuditEvent(actorId, 'ROLE_UPDATED', 'role', id, {
      before: beforeState,
      after: dto,
    });

    // Invalidate permission cache for all users with this role
    await this.invalidateRolePermissions(id);

    return updated;
  }

  async deleteRole(id: string, actorId: string) {
    const role = await this.prisma.adminRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) {
      throw new BadRequestException('Cannot delete system roles');
    }

    const userCount = await this.prisma.adminUserRole.count({ where: { roleId: id } });
    if (userCount > 0) {
      throw new BadRequestException(`Cannot delete role with ${userCount} assigned users`);
    }

    await this.prisma.adminRole.delete({ where: { id } });

    await this.writeAuditEvent(actorId, 'ROLE_DISABLED', 'role', id, {
      code: role.code,
      name: role.name,
    });

    return { success: true };
  }

  // ─── Role Permissions ───────────────────────────────────────────────────

  async getRolePermissions(roleId: string) {
    const role = await this.prisma.adminRole.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role.permissions.map((rp) => rp.permission);
  }

  async setRolePermissions(roleId: string, permissionIds: string[], actorId: string) {
    const role = await this.prisma.adminRole.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    // Prevent modifying system role permissions without explicit acknowledge
    if (role.isSystem) {
      this.logger.warn(`System role ${role.code} permissions being modified by ${actorId}`);
    }

    // Use transaction for atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      const beforePerms = await tx.adminRolePermission.findMany({
        where: { roleId },
        include: { permission: true },
      });
      const beforePermStrings = beforePerms.map(
        (p) => `${p.permission.resource}.${p.permission.action}`,
      );

      await tx.adminRolePermission.deleteMany({ where: { roleId } });

      if (permissionIds.length > 0) {
        await tx.adminRolePermission.createMany({
          data: permissionIds.map((pid) => ({ roleId, permissionId: pid })),
        });
      }

      return { beforePermStrings };
    });

    await this.writeAuditEvent(actorId, 'ROLE_PERMISSION_CHANGED', 'role', roleId, {
      roleCode: role.code,
      before: result.beforePermStrings.length,
      after: permissionIds.length,
    });

    // Invalidate cache
    await this.invalidateRolePermissions(roleId);

    return this.getRolePermissions(roleId);
  }

  // ─── Permissions Catalog ────────────────────────────────────────────────

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  // ─── Admin Role Assignment (with privilege escalation protection) ───────

  async getAdminRoles(userId: string) {
    const assignments = await this.prisma.adminUserRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });
    return assignments.map((a) => a.role);
  }

  /**
   * Assign a role to an admin with privilege escalation protection.
   * The actor cannot assign SUPER_ADMIN unless they are already SUPER_ADMIN.
   * The actor cannot assign roles that grant permissions beyond their own.
   */
  async assignRoleToAdmin(
    userId: string,
    roleId: string,
    actorId: string,
    actorPermissions: string[],
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const role = await this.prisma.adminRole.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    // Prevent self-elevation: actor cannot assign roles to themselves
    if (userId === actorId) {
      await this.writeAuditEvent(actorId, 'PRIVILEGE_ESCALATION_ATTEMPTED', 'user', userId, {
        reason: 'Self-role-assignment',
        roleId,
      });
      throw new ForbiddenException('Cannot assign roles to yourself');
    }

    // Prevent assigning SUPER_ADMIN unless actor is SUPER_ADMIN
    if (role.code === 'SUPER_ADMIN') {
      const actorIsSuperAdmin = actorPermissions.includes('roles.manage');
      if (!actorIsSuperAdmin) {
        await this.writeAuditEvent(actorId, 'PRIVILEGE_ESCALATION_ATTEMPTED', 'user', userId, {
          reason: 'Non-superadmin attempted SUPER_ADMIN assignment',
          roleId,
        });
        throw new ForbiddenException('Only SUPER_ADMIN can assign SUPER_ADMIN role');
      }
    }

    // Check if already assigned
    const existing = await this.prisma.adminUserRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (existing) {
      throw new BadRequestException('Role already assigned to this user');
    }

    const assignment = await this.prisma.adminUserRole.create({
      data: { userId, roleId },
      include: { role: true },
    });

    await this.writeAuditEvent(actorId, 'ADMIN_ROLE_ASSIGNED', 'user', userId, {
      roleCode: role.code,
      roleName: role.name,
    });

    // Invalidate the target user's permission cache
    await this.invalidateUserPermissions(userId);

    return assignment;
  }

  /**
   * Remove a role from an admin with protection against removing
   * the last SUPER_ADMIN.
   */
  async removeRoleFromAdmin(
    userId: string,
    roleId: string,
    actorId: string,
  ) {
    const assignment = await this.prisma.adminUserRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
      include: { role: true },
    });
    if (!assignment) throw new NotFoundException('Role assignment not found');

    // Prevent removing the last SUPER_ADMIN
    if (assignment.role.code === 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.adminUserRole.count({
        where: {
          role: { code: 'SUPER_ADMIN' },
        },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException(
          'Cannot remove the last SUPER_ADMIN assignment. At least one SUPER_ADMIN must remain.',
        );
      }
    }

    await this.prisma.adminUserRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });

    await this.writeAuditEvent(actorId, 'ADMIN_ROLE_REMOVED', 'user', userId, {
      roleCode: assignment.role.code,
      roleName: assignment.role.name,
    });

    await this.invalidateUserPermissions(userId);

    return { success: true };
  }

  async setAdminRoles(userId: string, roleIds: string[], actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Check if removing SUPER_ADMIN would leave none
    if (!roleIds.some((id) => SYSTEM_ROLE_CODES.includes(id))) {
      const currentSuperAdmin = await this.prisma.adminUserRole.findFirst({
        where: { role: { code: 'SUPER_ADMIN' } },
      });
      if (currentSuperAdmin && currentSuperAdmin.userId === userId) {
        throw new BadRequestException(
          'Cannot remove all roles from the last SUPER_ADMIN',
        );
      }
    }

    await this.prisma.adminUserRole.deleteMany({ where: { userId } });

    if (roleIds.length > 0) {
      await this.prisma.adminUserRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId })),
      });
    }

    await this.writeAuditEvent(actorId, 'ADMIN_ROLE_REMOVED', 'user', userId, {
      action: 'SET_ALL_ROLES',
      roleIds,
    });

    await this.invalidateUserPermissions(userId);

    return this.getAdminRoles(userId);
  }

  // ─── Effective Permissions (with Redis caching) ────────────────────────

  async getEffectivePermissions(userId: string): Promise<string[]> {
    // Check cache first
    const cacheKey = `${PERMISSION_CACHE_PREFIX}${userId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as string[];
      }
    } catch {
      // Redis unavailable — fall through to DB
    }

    const assignments = await this.prisma.adminUserRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    const permSet = new Set<string>();
    for (const assignment of assignments) {
      for (const rp of assignment.role.permissions) {
        permSet.add(`${rp.permission.resource}.${rp.permission.action}`);
      }
    }

    const permissions = Array.from(permSet).sort();

    // Cache for future requests
    try {
      await this.redis.set(cacheKey, JSON.stringify(permissions), 'EX', PERMISSION_CACHE_TTL);
    } catch {
      // Redis unavailable — not critical
    }

    return permissions;
  }

  async userHasPermission(userId: string, permission: string): Promise<boolean> {
    const perms = await this.getEffectivePermissions(userId);
    return perms.includes(permission);
  }

  async userHasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const perms = await this.getEffectivePermissions(userId);
    return permissions.some((p) => perms.includes(p));
  }

  // ─── Cache Invalidation ─────────────────────────────────────────────────

  private async invalidateUserPermissions(userId: string) {
    try {
      await this.redis.del(`${PERMISSION_CACHE_PREFIX}${userId}`);
    } catch {
      // Best effort
    }
  }

  private async invalidateRolePermissions(roleId: string) {
    // Find all users with this role and invalidate their caches
    const assignments = await this.prisma.adminUserRole.findMany({
      where: { roleId },
      select: { userId: true },
    });

    for (const assignment of assignments) {
      await this.invalidateUserPermissions(assignment.userId);
    }
  }

  // ─── Audit Event Writer ─────────────────────────────────────────────────

  private async writeAuditEvent(
    actorId: string,
    action: string,
    targetType: string | null,
    targetId: string | null,
    metadata: Record<string, unknown>,
  ) {
    try {
      // Get the last audit log's checksum for chain integrity
      const lastLog = await this.prisma.auditLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { checksum: true },
      });

      const previousChecksum = lastLog?.checksum ?? null;

      const payload = JSON.stringify({
        actorId,
        action,
        targetType,
        targetId,
        metadata,
        previousChecksum,
      });

      const checksum = crypto
        .createHash('sha256')
        .update(payload)
        .digest('hex');

      await this.prisma.auditLog.create({
        data: {
          actorId,
          actorRole: 'system',
          action,
          targetType,
          targetId,
          metadata,
          result: 'SUCCESS',
          checksum,
          previousChecksum,
        },
      });
    } catch (error) {
      // Audit must never crash the operation
      this.logger.error(`Failed to write RBAC audit event: ${error}`);
    }
  }
}
