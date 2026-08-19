import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../auth/jwt.strategy';

// ── /api/notifications ────────────────────────────────────────────────────────
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /api/notifications
   * Returns the authenticated user's unread, undismissed inbox notifications.
   * Cached in Redis (30 s). Invalidated on any write.
   *
   * Response: Notification[]
   * Each item: { id, title, message, type, category, isRead, isDismissed,
   *              priority, color (null for regular notifs), createdAt }
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  getNotifications(@CurrentUser() user: UserPayload) {
    return this.notificationService.getNotifications(user.id);
  }

  /** POST /api/notifications/:id/read — mark one notification as read */
  @UseGuards(JwtAuthGuard)
  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserPayload) {
    return this.notificationService.markAsRead(id, user.id);
  }

  /** POST /api/notifications/read-all — mark all as read */
  @UseGuards(JwtAuthGuard)
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@CurrentUser() user: UserPayload) {
    return this.notificationService.markAllAsRead(user.id);
  }

  /** POST /api/notifications/:id/dismiss — hide a notification permanently */
  @UseGuards(JwtAuthGuard)
  @Post(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  dismiss(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserPayload) {
    return this.notificationService.dismiss(id, user.id);
  }
}

// ── /api/banners ──────────────────────────────────────────────────────────────
@Controller('banners')
export class BannerController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /api/banners/active
   * Public — no auth required.
   * Cached in Redis (5 min). Invalidated when a banner is created, deleted, or dismissed.
   *
   * Response: BannerResponse[]
   * Each item:
   * {
   *   "id": 1,
   *   "title": "Admin Announcement",
   *   "message": "We're in beta — your feedback helps us improve.",
   *   "color": "#6366f1",       ← always a 6-digit hex string set by admin
   *   "dismissible": true,
   *   "link": null,             ← optional CTA URL
   *   "linkText": null,         ← optional CTA label
   *   "startDate": null,        ← ISO string or null
   *   "endDate": null,          ← ISO string or null
   *   "isGlobal": true,
   *   "createdAt": "2026-05-06T..."
   * }
   */
  @Get('active')
  getActiveBanners() {
    return this.notificationService.getActiveBanners();
  }
}
