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
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
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
  @RequirePermissions('roles.manage')
  @HttpCode(HttpStatus.CREATED)
  createRole(
    @Body() dto: { code: string; name: string; description?: string },
  ) {
    return this.rbacService.createRole(dto);
  }

  @Patch('roles/:id')
  @RequirePermissions('roles.manage')
  updateRole(
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string; isActive?: boolean },
  ) {
    return this.rbacService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @RequirePermissions('roles.manage')
  @HttpCode(HttpStatus.OK)
  deleteRole(@Param('id') id: string) {
    return this.rbacService.deleteRole(id);
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
    @Param('id') id: string,
    @Body() dto: { permissionIds: string[] },
  ) {
    return this.rbacService.setRolePermissions(id, dto.permissionIds);
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
  @RequirePermissions('admins.update')
  setAdminRoles(
    @Param('id') id: string,
    @Body() dto: { roleIds: string[] },
  ) {
    return this.rbacService.setAdminRoles(id, dto.roleIds);
  }

  @Post('admins/:id/roles')
  @RequirePermissions('admins.update')
  @HttpCode(HttpStatus.CREATED)
  assignRoleToAdmin(
    @Param('id') id: string,
    @Body() dto: { roleId: string },
  ) {
    return this.rbacService.assignRoleToAdmin(id, dto.roleId);
  }

  @Delete('admins/:id/roles/:roleId')
  @RequirePermissions('admins.update')
  @HttpCode(HttpStatus.OK)
  removeRoleFromAdmin(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ) {
    return this.rbacService.removeRoleFromAdmin(id, roleId);
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
    return this.rbacService.seed();
  }
}
