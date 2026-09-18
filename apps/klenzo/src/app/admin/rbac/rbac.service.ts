import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_CATALOG, ROLE_DEFINITIONS } from './permissions.catalog';
import { AdminRoleCode } from '@prisma/client';

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Seed (Idempotent) ──────────────────────────────────────────────────

  /**
   * Seed all permissions and the 5 system roles.
   * Idempotent — safe to run multiple times.
   */
  async seed() {
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

      // Get all permission IDs for this role
      const permissionPairs = roleDef.permissions.map((p) => {
        const [resource, action] = p.split('.');
        return { resource, action };
      });

      const permissions = await this.prisma.permission.findMany({
        where: {
          OR: permissionPairs.map((p) => ({ resource: p.resource, action: p.action })),
        },
      });

      // Clear existing and reassign
      await this.prisma.adminRolePermission.deleteMany({ where: { roleId: role.id } });
      await this.prisma.adminRolePermission.createMany({
        data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });

      this.logger.log(`  ✔ Role ${roleDef.name}: ${permissions.length} permissions`);
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
        permissions: {
          include: { permission: true },
        },
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

  async createRole(dto: { code: string; name: string; description?: string }) {
    // System roles cannot be created manually
    const systemCodes = ROLE_DEFINITIONS.map((r) => r.code);
    if (systemCodes.includes(dto.code)) {
      throw new BadRequestException(`Cannot manually create system role: ${dto.code}`);
    }

    return this.prisma.adminRole.create({
      data: {
        code: dto.code as AdminRoleCode,
        name: dto.name,
        description: dto.description,
        isSystem: false,
        isActive: true,
      },
    });
  }

  async updateRole(id: string, dto: { name?: string; description?: string; isActive?: boolean }) {
    const role = await this.prisma.adminRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    return this.prisma.adminRole.update({
      where: { id },
      data: dto,
    });
  }

  async deleteRole(id: string) {
    const role = await this.prisma.adminRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) {
      throw new BadRequestException('Cannot delete system roles');
    }

    // Check if any users have this role
    const userCount = await this.prisma.adminUserRole.count({ where: { roleId: id } });
    if (userCount > 0) {
      throw new BadRequestException(`Cannot delete role with ${userCount} assigned users`);
    }

    return this.prisma.adminRole.delete({ where: { id } });
  }

  // ─── Role Permissions ───────────────────────────────────────────────────

  async getRolePermissions(roleId: string) {
    const role = await this.prisma.adminRole.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role.permissions.map((rp) => rp.permission);
  }

  async setRolePermissions(roleId: string, permissionIds: string[]) {
    const role = await this.prisma.adminRole.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    // Clear existing
    await this.prisma.adminRolePermission.deleteMany({ where: { roleId } });

    // Set new
    if (permissionIds.length > 0) {
      await this.prisma.adminRolePermission.createMany({
        data: permissionIds.map((pid) => ({ roleId, permissionId: pid })),
      });
    }

    return this.getRolePermissions(roleId);
  }

  // ─── Permissions Catalog ────────────────────────────────────────────────

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  // ─── Admin Role Assignment ──────────────────────────────────────────────

  async getAdminRoles(userId: string) {
    const assignments = await this.prisma.adminUserRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });
    return assignments.map((a) => a.role);
  }

  async assignRoleToAdmin(userId: string, roleId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const role = await this.prisma.adminRole.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    // Check if already assigned
    const existing = await this.prisma.adminUserRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (existing) {
      throw new BadRequestException('Role already assigned to this user');
    }

    return this.prisma.adminUserRole.create({
      data: { userId, roleId },
      include: { role: true },
    });
  }

  async removeRoleFromAdmin(userId: string, roleId: string) {
    const assignment = await this.prisma.adminUserRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (!assignment) throw new NotFoundException('Role assignment not found');

    return this.prisma.adminUserRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });
  }

  async setAdminRoles(userId: string, roleIds: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Clear existing
    await this.prisma.adminUserRole.deleteMany({ where: { userId } });

    // Set new
    if (roleIds.length > 0) {
      await this.prisma.adminUserRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId })),
      });
    }

    return this.getAdminRoles(userId);
  }

  // ─── Effective Permissions ──────────────────────────────────────────────

  /**
   * Get the effective permissions for a user (union of all assigned roles).
   */
  async getEffectivePermissions(userId: string): Promise<string[]> {
    const assignments = await this.prisma.adminUserRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
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

    return Array.from(permSet).sort();
  }

  /**
   * Check if a user has a specific permission.
   */
  async userHasPermission(userId: string, permission: string): Promise<boolean> {
    const perms = await this.getEffectivePermissions(userId);
    return perms.includes(permission);
  }

  /**
   * Check if a user has any of the given permissions.
   */
  async userHasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const perms = await this.getEffectivePermissions(userId);
    return permissions.some((p) => perms.includes(p));
  }
}
