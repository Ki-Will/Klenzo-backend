import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { NotificationService } from '../notification/notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles('admin', 'superadmin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly notificationService: NotificationService,
  ) {}

  // ─── Platform Stats ───────────────────────────────────────────────────────

  @Get('stats')
  @RequirePermissions('system.health_read', 'analytics.read')
  getStats() {
    return this.adminService.getStats();
  }

  // ─── User Management ──────────────────────────────────────────────────────

  @Get('users')
  @RequirePermissions('users.read')
  getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Get('users/:id')
  @RequirePermissions('users.read')
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Post('users/:id/toggle-active')
  @RequirePermissions('users.suspend', 'users.reactivate')
  @HttpCode(HttpStatus.OK)
  toggleUserActive(
    @Param('id') id: string,
    @Body() dto: { active: boolean },
  ) {
    return this.adminService.toggleUserActive(id, dto.active);
  }

  @Delete('users/:id')
  @RequirePermissions('users.suspend')
  @HttpCode(HttpStatus.OK)
  deleteUser(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.adminService.deleteUser(id, user.id);
  }

  // ─── Admin Management ─────────────────────────────────────────────────────

  @Get('admins')
  @RequirePermissions('admins.read')
  getAdmins() {
    return this.adminService.getAdmins();
  }

  @Roles('superadmin')
  @RequirePermissions('admins.create')
  @Post('admins')
  @HttpCode(HttpStatus.CREATED)
  createAdmin(
    @CurrentUser() currentAdmin: UserPayload,
    @Body()
    dto: {
      email: string;
      password: string;
      name: string;
      role: string;
    },
  ) {
    return this.adminService.createAdmin(dto, currentAdmin);
  }

  @Roles('superadmin')
  @RequirePermissions('admins.disable')
  @Delete('admins/:id')
  @HttpCode(HttpStatus.OK)
  deleteAdmin(
    @CurrentUser() currentAdmin: UserPayload,
    @Param('id') id: string,
  ) {
    return this.adminService.deleteAdmin(id, currentAdmin);
  }

  // ─── Broadcast / Banners ──────────────────────────────────────────────────

  @Post('broadcast')
  @RequirePermissions('notifications.send')
  @HttpCode(HttpStatus.CREATED)
  async createBroadcast(
    @Body()
    dto: {
      title?: string;
      message: string;
      color?: string;
      dismissible?: boolean;
      link?: string;
      linkText?: string;
      startDate?: string;
      endDate?: string;
      sendEmail?: boolean;
      priority?: 'low' | 'normal' | 'high';
    },
  ) {
    const allUsers = await this.adminService.getAllActiveUsers();
    const userIds = allUsers.map((u) => u.id);
    const userEmails = allUsers.map((u) => ({ id: u.id, email: u.email }));

    return this.notificationService.createBroadcast(dto, userIds, userEmails);
  }

  @Get('broadcast')
  @RequirePermissions('notifications.read')
  getAllBroadcasts() {
    return this.notificationService.getAllBanners();
  }

  @Delete('broadcast/:id')
  @RequirePermissions('notifications.manage')
  @HttpCode(HttpStatus.OK)
  deleteBroadcast(@Param('id') id: string) {
    return this.notificationService.deleteBanner(id);
  }
}
