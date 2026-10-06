// Notification Service RPC Contracts

export type NotificationChannel = 'PUSH' | 'EMAIL' | 'SMS' | 'IN_APP';
export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type DevicePlatform = 'IOS' | 'ANDROID' | 'WEB';

export interface NotificationSummary {
  id: string;
  userId: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  priority: NotificationPriority;
  data?: Record<string, unknown>;
  readAt?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceTokenSummary {
  id: string;
  userId: string;
  token: string;
  platform: DevicePlatform;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

// Send notification (fire-and-forget via queue)
export interface SendNotificationRequest {
  userId: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  priority?: NotificationPriority;
  data?: Record<string, unknown>;
  scheduledAt?: string; // ISO 8601, for delayed delivery
  idempotencyKey?: string;
}

// Create notification record
export interface CreateNotificationRequest {
  userId: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  priority?: NotificationPriority;
  data?: Record<string, unknown>;
}

export interface CreateNotificationResponse {
  notification: NotificationSummary;
}

// Get notifications
export interface GetNotificationsRequest {
  userId: string;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface GetNotificationsResponse {
  notifications: NotificationSummary[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
}

// Mark as read
export interface MarkNotificationReadRequest {
  notificationId: string;
  userId: string;
}

export interface MarkNotificationReadResponse {
  notification: NotificationSummary;
}

// Register device token
export interface DeviceTokenRequest {
  userId: string;
  token: string;
  platform: DevicePlatform;
}

export interface DeviceTokenResponse {
  deviceToken: DeviceTokenSummary;
}

// Unregister device token
export interface UnregisterDeviceTokenRequest {
  userId: string;
  token: string;
}

export interface UnregisterDeviceTokenResponse {
  success: boolean;
}
