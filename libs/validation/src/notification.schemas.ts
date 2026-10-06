import { z } from 'zod';

// ─── Shared Enums ─────────────────────────────────────────────────────────

export const NotificationChannelSchema = z.enum(['PUSH', 'EMAIL', 'SMS', 'IN_APP']);
export const NotificationPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']);
export const DevicePlatformSchema = z.enum(['IOS', 'ANDROID', 'WEB']);

// ─── Send Notification ─────────────────────────────────────────────────────

export const SendNotificationSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title too long'),
  body: z.string().trim().min(1, 'Body is required').max(1000, 'Body too long'),
  channel: NotificationChannelSchema,
  priority: NotificationPrioritySchema.default('NORMAL'),
  data: z.record(z.unknown()).optional(),
  scheduledAt: z.string().datetime({ message: 'scheduledAt must be ISO 8601' }).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

export type SendNotificationInput = z.infer<typeof SendNotificationSchema>;

// ─── Register Device Token ─────────────────────────────────────────────────

export const RegisterDeviceSchema = z.object({
  token: z
    .string()
    .trim()
    .min(10, 'Device token is too short')
    .max(512, 'Device token is too long'),
  platform: DevicePlatformSchema,
});

export type RegisterDeviceInput = z.infer<typeof RegisterDeviceSchema>;

// ─── Get Notifications Query ────────────────────────────────────────────────

export const GetNotificationsQuerySchema = z.object({
  channel: NotificationChannelSchema.optional(),
  unreadOnly: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type GetNotificationsQueryInput = z.infer<typeof GetNotificationsQuerySchema>;
