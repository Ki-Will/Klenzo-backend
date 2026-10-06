// Typed Queue Message Contracts
// All messages use discriminated unions for type-safe processing in queue consumers

// ─── Base ──────────────────────────────────────────────────────────────────

export interface BaseQueueMessage {
  messageId: string;      // Unique message identifier (crypto.randomUUID())
  traceId?: string;       // Distributed tracing correlation ID
  timestamp: string;      // ISO 8601 creation time
  retryCount?: number;    // Number of delivery attempts
  userId?: string;        // Associated user if applicable
}

// ─── Notification Jobs ──────────────────────────────────────────────────────

export interface PushNotificationJob extends BaseQueueMessage {
  type: 'NOTIFICATION_PUSH';
  payload: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    deviceTokens?: string[];
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  };
}

export interface EmailNotificationJob extends BaseQueueMessage {
  type: 'NOTIFICATION_EMAIL';
  payload: {
    to: string;
    templateId: string;
    subject: string;
    variables: Record<string, string>;
    replyTo?: string;
    cc?: string[];
  };
}

export interface SmsNotificationJob extends BaseQueueMessage {
  type: 'NOTIFICATION_SMS';
  payload: {
    to: string;
    message: string;
    userId?: string;
  };
}

export type NotificationJob =
  | PushNotificationJob
  | EmailNotificationJob
  | SmsNotificationJob;

// ─── Analytics Jobs ──────────────────────────────────────────────────────────

export interface UserEventAnalyticsJob extends BaseQueueMessage {
  type: 'ANALYTICS_USER_EVENT';
  payload: {
    userId: string;
    event: string;
    properties: Record<string, unknown>;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface MetricsAggregationJob extends BaseQueueMessage {
  type: 'ANALYTICS_METRICS_AGGREGATION';
  payload: {
    metric: string;
    dimensions: Record<string, string>;
    value: number;
    unit: string;
    period: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    periodStart: string;
  };
}

export interface ReportGenerationJob extends BaseQueueMessage {
  type: 'ANALYTICS_REPORT_GENERATION';
  payload: {
    reportType: 'HABIT' | 'FINANCE' | 'PRODUCTIVITY' | 'OVERVIEW';
    userId: string;
    period: string;
    startDate: string;
    endDate: string;
    outputFormat: 'JSON' | 'PDF' | 'CSV';
    deliveryMethod: 'EMAIL' | 'WEBHOOK' | 'STORE';
    deliveryTarget?: string;
  };
}

export type AnalyticsJob =
  | UserEventAnalyticsJob
  | MetricsAggregationJob
  | ReportGenerationJob;

// ─── Webhook Jobs ────────────────────────────────────────────────────────────

export interface OutboundWebhookJob extends BaseQueueMessage {
  type: 'WEBHOOK_OUTBOUND';
  payload: {
    webhookId: string;
    targetUrl: string;
    event: string;
    data: Record<string, unknown>;
    secret?: string;
    headers?: Record<string, string>;
    maxRetries?: number;
  };
}

export interface WebhookRetryJob extends BaseQueueMessage {
  type: 'WEBHOOK_RETRY';
  payload: {
    webhookId: string;
    originalJobId: string;
    targetUrl: string;
    event: string;
    data: Record<string, unknown>;
    headers?: Record<string, string>;
    attemptNumber: number;
    lastError?: string;
  };
}

export type WebhookJob = OutboundWebhookJob | WebhookRetryJob;

// ─── Insight Jobs ─────────────────────────────────────────────────────────────

export interface HabitInsightJob extends BaseQueueMessage {
  type: 'INSIGHT_HABIT_ANALYSIS';
  payload: {
    userId: string;
    habitIds?: string[];
    period: 'WEEKLY' | 'MONTHLY';
    triggerReason: 'SCHEDULED' | 'USER_REQUEST' | 'STREAK_MILESTONE';
  };
}

export interface FinanceInsightJob extends BaseQueueMessage {
  type: 'INSIGHT_FINANCE_ANALYSIS';
  payload: {
    userId: string;
    walletIds?: string[];
    period: 'WEEKLY' | 'MONTHLY';
    triggerReason: 'SCHEDULED' | 'USER_REQUEST' | 'ANOMALY_DETECTED';
    anomalyData?: Record<string, unknown>;
  };
}

export interface ProductivityInsightJob extends BaseQueueMessage {
  type: 'INSIGHT_PRODUCTIVITY_ANALYSIS';
  payload: {
    userId: string;
    period: 'WEEKLY' | 'MONTHLY';
    triggerReason: 'SCHEDULED' | 'USER_REQUEST';
  };
}

export interface AnomalyDetectionJob extends BaseQueueMessage {
  type: 'INSIGHT_ANOMALY_DETECTION';
  payload: {
    userId: string;
    domain: 'FINANCE' | 'HABIT' | 'PRODUCTIVITY';
    dataSnapshot: Record<string, unknown>;
  };
}

export type InsightJob =
  | HabitInsightJob
  | FinanceInsightJob
  | ProductivityInsightJob
  | AnomalyDetectionJob;

// ─── Finance Jobs ─────────────────────────────────────────────────────────────

export interface TransactionProcessingJob extends BaseQueueMessage {
  type: 'FINANCE_TRANSACTION_PROCESSING';
  payload: {
    transactionId: string;
    walletId: string;
    amount: string;
    currency: string;
    type: 'CREDIT' | 'DEBIT' | 'TRANSFER';
    idempotencyKey: string;
  };
}

export interface ReconciliationJob extends BaseQueueMessage {
  type: 'FINANCE_RECONCILIATION';
  payload: {
    walletId?: string;
    accountId?: string;
    period: { startDate: string; endDate: string };
  };
}

export type FinanceJob = TransactionProcessingJob | ReconciliationJob;

// ─── Master Union ─────────────────────────────────────────────────────────────

export type QueueMessage =
  | NotificationJob
  | AnalyticsJob
  | WebhookJob
  | InsightJob
  | FinanceJob;

export type QueueMessageType = QueueMessage['type'];

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function isNotificationJob(msg: QueueMessage): msg is NotificationJob {
  return (
    msg.type === 'NOTIFICATION_PUSH' ||
    msg.type === 'NOTIFICATION_EMAIL' ||
    msg.type === 'NOTIFICATION_SMS'
  );
}

export function isAnalyticsJob(msg: QueueMessage): msg is AnalyticsJob {
  return (
    msg.type === 'ANALYTICS_USER_EVENT' ||
    msg.type === 'ANALYTICS_METRICS_AGGREGATION' ||
    msg.type === 'ANALYTICS_REPORT_GENERATION'
  );
}

export function isWebhookJob(msg: QueueMessage): msg is WebhookJob {
  return msg.type === 'WEBHOOK_OUTBOUND' || msg.type === 'WEBHOOK_RETRY';
}

export function isInsightJob(msg: QueueMessage): msg is InsightJob {
  return (
    msg.type === 'INSIGHT_HABIT_ANALYSIS' ||
    msg.type === 'INSIGHT_FINANCE_ANALYSIS' ||
    msg.type === 'INSIGHT_PRODUCTIVITY_ANALYSIS' ||
    msg.type === 'INSIGHT_ANOMALY_DETECTION'
  );
}

export function isFinanceJob(msg: QueueMessage): msg is FinanceJob {
  return (
    msg.type === 'FINANCE_TRANSACTION_PROCESSING' ||
    msg.type === 'FINANCE_RECONCILIATION'
  );
}
