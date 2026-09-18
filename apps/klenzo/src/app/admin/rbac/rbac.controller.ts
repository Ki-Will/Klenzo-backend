import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RbacService } from './rbac.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface UserPayload {
  id: string;
  email: string;
  role: string;
  permissions?: string[];
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles('admin', 'superadmin')
@Controller('admin')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  // ─── Roles CRUD ─────────────────────────────────────────────────────────

  @Get('roles')
  @RequirePermissions('roles.read')
  getAllRoles() {
    return this.rbacService.getAllRoles();
  }

  @Get('roles/:id')
  @RequirePermissions('roles.read')
  getRoleById(@Param('id') id: string) {
    return this.rbacService.getRoleById(id);
  }

  @Post('roles')
  @RequirePermissions('roles.create')
  @HttpCode(HttpStatus.CREATED)
  createRole(
    @CurrentUser() user: UserPayload,
    @Body() dto: { code: string; name: string; description?: string },
  ) {
    return this.rbacService.createRole(dto, user.id);
  }

  @Patch('roles/:id')
  @RequirePermissions('roles.update')
  updateRole(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string; isActive?: boolean },
  ) {
    return this.rbacService.updateRole(id, dto, user.id);
  }

  @Delete('roles/:id')
  @RequirePermissions('roles.delete')
  @HttpCode(HttpStatus.OK)
  deleteRole(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
  ) {
    return this.rbacService.deleteRole(id, user.id);
  }

  // ─── Role Permissions ───────────────────────────────────────────────────

  @Get('roles/:id/permissions')
  @RequirePermissions('permissions.read')
  getRolePermissions(@Param('id') id: string) {
    return this.rbacService.getRolePermissions(id);
  }

  @Put('roles/:id/permissions')
  @RequirePermissions('permissions.manage')
  setRolePermissions(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: { permissionIds: string[] },
  ) {
    return this.rbacService.setRolePermissions(id, dto.permissionIds, user.id);
  }

  // ─── Permissions Catalog ────────────────────────────────────────────────

  @Get('permissions')
  @RequirePermissions('permissions.read')
  getAllPermissions() {
    return this.rbacService.getAllPermissions();
  }

  // ─── Admin Role Assignment ──────────────────────────────────────────────

  @Get('admins/:id/roles')
  @RequirePermissions('admins.read')
  getAdminRoles(@Param('id') id: string) {
    return this.rbacService.getAdminRoles(id);
  }

  @Put('admins/:id/roles')
  @RequirePermissions('admins.assign_role')
  setAdminRoles(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: { roleIds: string[] },
  ) {
    return this.rbacService.setAdminRoles(id, dto.roleIds, user.id);
  }

  @Post('admins/:id/roles')
  @RequirePermissions('admins.assign_role')
  @HttpCode(HttpStatus.CREATED)
  assignRoleToAdmin(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: { roleId: string },
  ) {
    return this.rbacService.assignRoleToAdmin(
      id,
      dto.roleId,
      user.id,
      user.permissions ?? [],
    );
  }

  @Delete('admins/:id/roles/:roleId')
  @RequirePermissions('admins.assign_role')
  @HttpCode(HttpStatus.OK)
  removeRoleFromAdmin(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ) {
    return this.rbacService.removeRoleFromAdmin(id, roleId, user.id);
  }

  // ─── Effective Permissions ──────────────────────────────────────────────

  @Get('admins/:id/effective-permissions')
  @RequirePermissions('permissions.read')
  getEffectivePermissions(@Param('id') id: string) {
    return this.rbacService.getEffectivePermissions(id);
  }

  // ─── Seed (Super Admin only) ───────────────────────────────────────────

  @Post('rbac/seed')
  @Roles('superadmin')
  @RequirePermissions('roles.manage')
  seedRbac(@CurrentUser() user: UserPayload) {
    return this.rbacService.seed(user.id);
  }
}
