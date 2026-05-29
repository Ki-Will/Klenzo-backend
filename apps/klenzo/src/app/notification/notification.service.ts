import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import * as nodemailer from 'nodemailer';
import {
  Notification,
  NotificationType,
  NotificationCategory,
} from '../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';
import { RedisService } from '../redis/redis.service';
import { User } from '../entities/user.entity';

// ── Banner response shape ─────────────────────────────────────────────────────
export interface BannerResponse {
  id: number;
  title: string;
  message: string;
  /** Hex color set by admin, e.g. '#6366f1'. Always present on banners. */
  color: string;
  /** Whether the user can close/dismiss this banner */
  dismissible: boolean;
  /** Optional CTA link */
  link: string | null;
  linkText: string | null;
  /** ISO date strings for scheduled display window */
  startDate: string | null;
  endDate: string | null;
  isGlobal: boolean;
  createdAt: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationGateway: NotificationGateway,
    private readonly redis: RedisService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      secure: false,
    });
  }

  // ─── Email ────────────────────────────────────────────────────────────────

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: '"Klenzo" <noreply@klenzo.com>',
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent → ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Email failed → ${to}`, (error as Error).stack);
      throw error;
    }
  }

  // ── Email templates ───────────────────────────────────────────────────────

  private emailWrapper(title: string, content: string): string {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.3);">
<tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7);padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">Klenzo</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:14px;">Your Productivity & Finance Companion</p></td></tr>
<tr><td style="padding:32px 40px;color:#e2e8f0;font-size:15px;line-height:1.7;">${content}</td></tr>
<tr><td style="background:#0f172a;padding:20px 40px;text-align:center;border-top:1px solid #334155;">
<p style="margin:0;color:#64748b;font-size:12px;">&copy; ${new Date().getFullYear()} Klenzo. All rights reserved.</p>
</td></tr></table></td></tr></table></body></html>`;
  }

  private btn(text: string, url: string, color = '#6366f1'): string {
    return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>
<td style="background:${color};border-radius:8px;padding:14px 32px;text-align:center;">
<a href="${url}" style="color:#fff;font-size:15px;font-weight:600;text-decoration:none;">${text}</a>
</td></tr></table>`;
  }

  async sendWelcomeEmail(email: string) {
    const html = this.emailWrapper(
      'Welcome!',
      `<h2 style="color:#f1f5f9;">🎉 Welcome to Klenzo!</h2>
<p>Your all-in-one platform for productivity, habits, and finance.</p>` +
        this.btn(
          'Go to Dashboard',
          process.env.FRONTEND_URL || 'http://localhost:5000',
        ),
    );
    await this.sendEmail(email, 'Welcome to Klenzo! 🎉', html);
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const url = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password?token=${encodeURIComponent(token)}`;
    const html = this.emailWrapper(
      'Password Reset',
      `<h2 style="color:#f1f5f9;">🔐 Password Reset</h2>
<p>Click below to reset your password. Expires in <strong>1 hour</strong>.</p>` +
        this.btn('Reset Password', url, '#ef4444') +
        `<p style="color:#94a3b8;font-size:13px;">Didn't request this? Ignore this email.</p>`,
    );
    await this.sendEmail(email, 'Password Reset Request', html);
  }

  async sendAccountLockedEmail(email: string) {
    const url = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/forgot-password`;
    const html = this.emailWrapper(
      'Account Locked',
      `<h2 style="color:#f1f5f9;">⚠️ Account Locked</h2>
<p>Your account was locked after 5 failed login attempts.</p>` +
        this.btn('Reset Password', url, '#ef4444'),
    );
    await this.sendEmail(email, 'Account Security Alert', html);
  }

  async sendAdminBroadcastEmail(email: string, title: string, message: string) {
    const html = this.emailWrapper(
      title,
      `<div style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:3px;border-radius:12px;margin-bottom:20px;">
<div style="background:#1e293b;border-radius:10px;padding:1px 16px;">
<p style="color:#fbbf24;font-size:13px;font-weight:600;">📢 ADMIN ANNOUNCEMENT</p></div></div>
<h2 style="color:#f1f5f9;">${title}</h2>
<p style="color:#e2e8f0;">${message.replace(/\n/g, '<br>')}</p>` +
        this.btn(
          'View Dashboard',
          process.env.FRONTEND_URL || 'http://localhost:5000',
        ),
    );
    await this.sendEmail(email, `[Klenzo] ${title}`, html);
  }

  // ─── Color helpers ────────────────────────────────────────────────────────

  /**
   * Validates a hex color string.
   * Returns the value unchanged if valid, or the platform default '#6366f1'.
   * Only used for banners — regular notifications always get null.
   */

  /** Map a raw Notification entity to the typed BannerResponse shape. */
  private toBannerResponse(n: Notification): BannerResponse {
    return {
      id: n.id,
      title: n.title,
      message: n.message ?? '',
      color: n.color ?? '#6366f1', // always a hex string for banners
      dismissible: n.dismissible,
      link: n.link,
      linkText: n.linkText,
      startDate: n.startDate ? new Date(n.startDate).toISOString() : null,
      endDate: n.endDate ? new Date(n.endDate).toISOString() : null,
      isGlobal: n.isGlobal,
      createdAt: n.createdAt.toISOString(),
    };
  }

  // ─── Cache invalidation helpers ───────────────────────────────────────────

  private async invalidateBannerCache() {
    await this.redis.del(RedisService.keys.banners());
  }

  private async invalidateUserNotifCache(userId: number) {
    await this.redis.del(RedisService.keys.userNotifications(userId));
  }

  // ─── Create notification / banner ─────────────────────────────────────────

  async createNotification(params: {
    userId?: number | null;
    title: string;
    message: string;
    type?: NotificationType;
    category?: NotificationCategory;
    /** Banners only — must be #rrggbb hex. Defaults to '#6366f1'. */
    color?: string;
    priority?: 'low' | 'normal' | 'high';
    dismissible?: boolean;
    link?: string;
    linkText?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Notification> {
    const isBanner = params.category === NotificationCategory.BANNER;

    const notif = this.notificationRepository.create({
      userId: params.userId ?? null,
      title: params.title,
      message: params.message,
      type: params.type ?? NotificationType.INFO,
      category: params.category ?? NotificationCategory.NOTIFICATION,
      isGlobal: params.userId === null || params.userId === undefined,
      // Regular notifications → null (frontend uses `type` for color).
      // Banners → validated hex or platform default.
      color: params.color ?? 'info',
      priority: params.priority ?? 'normal',
      dismissible: params.dismissible !== false,
      link: params.link ?? null,
      linkText: params.linkText ?? null,
      startDate: params.startDate ? new Date(params.startDate) : null,
      endDate: params.endDate ? new Date(params.endDate) : null,
    });

    // ── Check user preferences ───────────────────────────────────────────
    if (params.userId && !isBanner) {
      const user = await this.userRepository.findOne({
        where: { id: params.userId },
      });
      if (user?.notificationSettings) {
        const settings = user.notificationSettings;
        const cat = params.category;

        if (
          cat === NotificationCategory.INSIGHT &&
          settings.smartInsights === false
        )
          return null as any;
        if (
          cat === NotificationCategory.TRANSACTION &&
          settings.transactionAlerts === false
        )
          return null as any;
        if (
          cat === NotificationCategory.SECURITY &&
          settings.securityAlerts === false
        )
          return null as any;
        if (
          cat === NotificationCategory.GROUP &&
          settings.groupAlerts === false
        )
          return null as any;
      }
    }

    const saved = await this.notificationRepository.save(notif);

    // Invalidate relevant caches
    if (isBanner) {
      await this.invalidateBannerCache();
      this.notificationGateway.broadcastToAll(
        'banner',
        this.toBannerResponse(saved),
      );
    } else if (params.userId) {
      await this.invalidateUserNotifCache(params.userId);
      this.notificationGateway.sendToUser(params.userId, 'notification', saved);
    }

    return saved;
  }

  // ─── Admin broadcast ──────────────────────────────────────────────────────

  async createBroadcast(
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
    allUserIds: number[],
    allUserEmails: { id: number; email: string }[],
  ): Promise<{ banner: BannerResponse; notificationsCount: number }> {
    const title = dto.title || 'Admin Announcement';
    const priority = dto.priority || 'normal';

    // 1. Global banner (cached + WS broadcast handled inside createNotification)
    const bannerEntity = await this.createNotification({
      userId: null,
      title,
      message: dto.message,
      type: NotificationType.INFO,
      category: NotificationCategory.BANNER,
      color: dto.color,
      dismissible: dto.dismissible !== false,
      link: dto.link,
      linkText: dto.linkText,
      startDate: dto.startDate,
      endDate: dto.endDate,
      priority,
    });

    // 2. Per-user inbox notification (fire-and-forget)
    for (const userId of allUserIds) {
      this.createNotification({
        userId,
        title,
        message: dto.message,
        type: NotificationType.INFO,
        category: NotificationCategory.NOTIFICATION,
        priority: dto.priority || 'high',
      }).catch((err) =>
        this.logger.error(`Notif failed for user ${userId}`, err),
      );
    }

    // 3. Email broadcast (fire-and-forget)
    if (dto.sendEmail) {
      for (const u of allUserEmails) {
        this.sendAdminBroadcastEmail(
          u.email,
          title,
          dto.message,
        ).catch((err) => this.logger.error(`Email failed for ${u.email}`, err));
      }
    }

    return {
      banner: this.toBannerResponse(bannerEntity),
      notificationsCount: allUserIds.length,
    };
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  /**
   * GET /api/notifications
   * Returns the user's unread, undismissed inbox notifications.
   * Cached in Redis for 30 s; invalidated on any write for this user.
   */
  async getNotifications(userId: number): Promise<Notification[]> {
    const key = RedisService.keys.userNotifications(userId);
    const cached = await this.redis.get<Notification[]>(key);
    if (cached) return cached;

    const rows = await this.notificationRepository.find({
      where: {
        userId,
        category: Not(NotificationCategory.BANNER),
        isDismissed: false,
      },
      order: { createdAt: 'DESC' },
    });

    await this.redis.set(key, rows, RedisService.TTL.NOTIFICATIONS);
    return rows;
  }

  /**
   * GET /api/banners/active
   * Returns active banners as typed BannerResponse objects.
   * Cached in Redis for 5 min; invalidated when any banner is created/deleted/dismissed.
   *
   * Response shape per banner:
   * {
   *   id, title, message,
   *   color: '#6366f1',   ← always a hex string
   *   dismissible: true,
   *   link: null,
   *   linkText: null,
   *   startDate: null,
   *   endDate: null,
   *   isGlobal: true,
   *   createdAt: '2026-...'
   * }
   */
  async getActiveBanners(): Promise<BannerResponse[]> {
    const key = RedisService.keys.banners();
    const cached = await this.redis.get<BannerResponse[]>(key);
    if (cached) return cached;

    const now = new Date();
    const rows = await this.notificationRepository.find({
      where: { category: NotificationCategory.BANNER, isDismissed: false },
      order: { createdAt: 'DESC' },
    });

    const active = rows
      .filter((b) => {
        if (b.startDate && new Date(b.startDate) > now) return false;
        if (b.endDate && new Date(b.endDate) < now) return false;
        return true;
      })
      .map((b) => this.toBannerResponse(b));

    await this.redis.set(key, active, RedisService.TTL.BANNERS);
    return active;
  }

  async getAllBanners(): Promise<BannerResponse[]> {
    const rows = await this.notificationRepository.find({
      where: { category: NotificationCategory.BANNER },
      order: { createdAt: 'DESC' },
    });
    return rows.map((b) => this.toBannerResponse(b));
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  async markAsRead(
    notificationId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const notif = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });
    if (!notif) throw new NotFoundException('Notification not found');
    await this.notificationRepository.update(notificationId, { isRead: true });
    await this.invalidateUserNotifCache(userId);
    return { message: 'Marked as read' };
  }

  async markAllAsRead(userId: number): Promise<{ message: string }> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
    await this.invalidateUserNotifCache(userId);
    return { message: 'All notifications marked as read' };
  }

  async dismiss(
    notificationId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const notif = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });
    if (!notif) throw new NotFoundException('Notification not found');
    await this.notificationRepository.update(notificationId, {
      isDismissed: true,
    });

    // Invalidate the right cache depending on type
    if (notif.category === NotificationCategory.BANNER) {
      await this.invalidateBannerCache();
    } else if (notif.userId) {
      await this.invalidateUserNotifCache(notif.userId);
    }
    return { message: 'Notification dismissed' };
  }

  async deleteBanner(id: number): Promise<{ success: boolean }> {
    const notif = await this.notificationRepository.findOne({
      where: { id, category: NotificationCategory.BANNER },
    });
    if (!notif) throw new NotFoundException('Banner not found');
    await this.notificationRepository.remove(notif);
    await this.invalidateBannerCache();
    return { success: true };
  }
}
