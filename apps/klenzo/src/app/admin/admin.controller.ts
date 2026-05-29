import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { NotificationService } from '../notification/notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly notificationService: NotificationService,
  ) {}

  // ─── Platform Stats ───────────────────────────────────────────────────────

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  // ─── User Management ──────────────────────────────────────────────────────

  @Get('users')
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
  getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUserById(id);
  }

  @Post('users/:id/toggle-active')
  @HttpCode(HttpStatus.OK)
  toggleUserActive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { active: boolean },
  ) {
    return this.adminService.toggleUserActive(id, dto.active);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  deleteUser(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteUser(id, user.id);
  }

  // ─── Admin Management ─────────────────────────────────────────────────────

  @Get('admins')
  getAdmins() {
    return this.adminService.getAdmins();
  }

  @Roles('superadmin')
  @Post('admins')
  @HttpCode(HttpStatus.CREATED)
  createAdmin(
    @CurrentUser() currentAdmin: User,
    @Body()
    dto: {
      email: string;
      password: string;
      name: string;
      role: 'admin' | 'superadmin';
    },
  ) {
    return this.adminService.createAdmin(dto, currentAdmin);
  }

  @Roles('superadmin')
  @Delete('admins/:id')
  @HttpCode(HttpStatus.OK)
  deleteAdmin(
    @CurrentUser() currentAdmin: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminService.deleteAdmin(id, currentAdmin);
  }

  // ─── Broadcast / Banners ──────────────────────────────────────────────────

  @Post('broadcast')
  @HttpCode(HttpStatus.CREATED)
  async createBroadcast(
    @Body()
    dto: {
      title?: string;
      message: string;
      /**
       * Optional hex color for the banner background.
       * Must be a 6-digit hex string: '#rrggbb'.
       * Defaults to the platform indigo '#6366f1' if omitted or invalid.
       */
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
    // Validate hex format — reject anything that isn't #rrggbb
    // if (dto.color !== undefined) {
    //   const HEX_RE = /^#[0-9a-fA-F]{6}$/;
    //   if (!HEX_RE.test(dto.color)) {
    //     dto.color = '#6366f1'; // silently fall back to default
    //   }
    // }

    const allUsers = await this.adminService.getAllActiveUsers();
    const userIds = allUsers.map((u) => u.id);
    const userEmails = allUsers.map((u) => ({ id: u.id, email: u.email }));
    console.log(dto);

    return this.notificationService.createBroadcast(dto, userIds, userEmails);
  }

  @Get('broadcast')
  getAllBroadcasts() {
    return this.notificationService.getAllBanners();
  }

  @Delete('broadcast/:id')
  @HttpCode(HttpStatus.OK)
  deleteBroadcast(@Param('id', ParseIntPipe) id: number) {
    return this.notificationService.deleteBanner(id);
  }
}
