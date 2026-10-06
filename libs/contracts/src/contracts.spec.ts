/**
 * Contract tests for @klenzo/contracts (Phase 2).
 *
 * Covers: queue message serialization round-trips, discriminated-union type
 * guards across every message type, and auth contract shape stability.
 */

import {
  isAnalyticsJob,
  isFinanceJob,
  isInsightJob,
  isNotificationJob,
  isWebhookJob,
  type QueueMessage,
  type QueueMessageType,
  type PushNotificationJob,
  type TransactionProcessingJob,
} from './queue-messages';
import type {
  LoginResponse,
  RegisterRequest,
  ValidateTokenResponse,
  UserSummary,
} from './auth.contracts';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const pushJob: PushNotificationJob = {
  messageId: '11111111-1111-4111-8111-111111111111',
  traceId: 'trace-1',
  timestamp: '2026-10-05T12:00:00.000Z',
  retryCount: 0,
  userId: 'user-1',
  type: 'NOTIFICATION_PUSH',
  payload: {
    userId: 'user-1',
    title: 'Streak at risk',
    body: 'Log your habit today to keep the streak.',
    priority: 'HIGH',
    deviceTokens: ['token-a'],
  },
};

const financeJob: TransactionProcessingJob = {
  messageId: '22222222-2222-4222-8222-222222222222',
  timestamp: '2026-10-05T12:00:01.000Z',
  type: 'FINANCE_TRANSACTION_PROCESSING',
  payload: {
    transactionId: 'tx-1',
    walletId: 'wallet-1',
    amount: '125.50',
    currency: 'USD',
    type: 'DEBIT',
    idempotencyKey: '33333333-3333-4333-8333-333333333333',
  },
};

/** Every discriminant value in the QueueMessage union. */
const ALL_TYPES: QueueMessageType[] = [
  'NOTIFICATION_PUSH',
  'NOTIFICATION_EMAIL',
  'NOTIFICATION_SMS',
  'ANALYTICS_USER_EVENT',
  'ANALYTICS_METRICS_AGGREGATION',
  'ANALYTICS_REPORT_GENERATION',
  'WEBHOOK_OUTBOUND',
  'WEBHOOK_RETRY',
  'INSIGHT_HABIT_ANALYSIS',
  'INSIGHT_FINANCE_ANALYSIS',
  'INSIGHT_PRODUCTIVITY_ANALYSIS',
  'INSIGHT_ANOMALY_DETECTION',
  'FINANCE_TRANSACTION_PROCESSING',
  'FINANCE_RECONCILIATION',
];

function minimalMessage(type: QueueMessageType): QueueMessage {
  const base = {
    messageId: '44444444-4444-4444-8444-444444444444',
    timestamp: '2026-10-05T12:00:02.000Z',
    type,
  };
  switch (type) {
    case 'NOTIFICATION_PUSH':
      return { ...base, payload: { userId: 'u', title: 't', body: 'b', priority: 'NORMAL' } } as QueueMessage;
    case 'NOTIFICATION_EMAIL':
      return { ...base, payload: { to: 'a@b.c', templateId: 'tpl', subject: 's', variables: {} } } as QueueMessage;
    case 'NOTIFICATION_SMS':
      return { ...base, payload: { to: '+15551234567', message: 'hi' } } as QueueMessage;
    case 'ANALYTICS_USER_EVENT':
      return { ...base, payload: { userId: 'u', event: 'habit.logged', properties: {} } } as QueueMessage;
    case 'ANALYTICS_METRICS_AGGREGATION':
      return {
        ...base,
        payload: {
          metric: 'habits.completed',
          dimensions: { plan: 'free' },
          value: 1,
          unit: 'count',
          period: 'DAILY',
          periodStart: '2026-10-05T00:00:00.000Z',
        },
      } as QueueMessage;
    case 'ANALYTICS_REPORT_GENERATION':
      return {
        ...base,
        payload: {
          reportType: 'HABIT',
          userId: 'u',
          period: 'WEEKLY',
          startDate: '2026-09-28',
          endDate: '2026-10-04',
          outputFormat: 'JSON',
          deliveryMethod: 'STORE',
        },
      } as QueueMessage;
    case 'WEBHOOK_OUTBOUND':
      return { ...base, payload: { webhookId: 'w1', targetUrl: 'https://x.y/hook', event: 'e', data: {} } } as QueueMessage;
    case 'WEBHOOK_RETRY':
      return {
        ...base,
        payload: { webhookId: 'w1', originalJobId: 'j1', targetUrl: 'https://x.y/hook', event: 'e', data: {}, attemptNumber: 2 },
      } as QueueMessage;
    case 'INSIGHT_HABIT_ANALYSIS':
      return { ...base, payload: { userId: 'u', period: 'WEEKLY', triggerReason: 'SCHEDULED' } } as QueueMessage;
    case 'INSIGHT_FINANCE_ANALYSIS':
      return { ...base, payload: { userId: 'u', period: 'MONTHLY', triggerReason: 'SCHEDULED' } } as QueueMessage;
    case 'INSIGHT_PRODUCTIVITY_ANALYSIS':
      return { ...base, payload: { userId: 'u', period: 'WEEKLY', triggerReason: 'USER_REQUEST' } } as QueueMessage;
    case 'INSIGHT_ANOMALY_DETECTION':
      return { ...base, payload: { userId: 'u', domain: 'FINANCE', dataSnapshot: {} } } as QueueMessage;
    case 'FINANCE_TRANSACTION_PROCESSING':
      return financeJob as QueueMessage;
    case 'FINANCE_RECONCILIATION':
      return {
        ...base,
        payload: { period: { startDate: '2026-09-01', endDate: '2026-09-30' } },
      } as QueueMessage;
    default: {
      const exhaustive: never = type;
      throw new Error(`unhandled type ${String(exhaustive)}`);
    }
  }
}

// ─── Serialization round-trips ──────────────────────────────────────────────

describe('queue message serialization', () => {
  it('round-trips a push notification job through JSON', () => {
    const restored = JSON.parse(JSON.stringify(pushJob)) as PushNotificationJob;
    expect(restored).toEqual(pushJob);
    expect(restored.type).toBe('NOTIFICATION_PUSH');
    expect(restored.payload.priority).toBe('HIGH');
  });

  it('round-trips a finance job without losing decimal string amounts', () => {
    const restored = JSON.parse(JSON.stringify(financeJob)) as TransactionProcessingJob;
    expect(restored.payload.amount).toBe('125.50'); // string, never a float
    expect(restored.payload.idempotencyKey).toBe(financeJob.payload.idempotencyKey);
  });

  it('preserves ISO 8601 timestamps as strings', () => {
    const restored = JSON.parse(JSON.stringify(pushJob)) as PushNotificationJob;
    expect(typeof restored.timestamp).toBe('string');
    expect(new Date(restored.timestamp).toISOString()).toBe(restored.timestamp);
  });
});

// ─── Type guards ────────────────────────────────────────────────────────────

describe('queue message type guards', () => {
  it('classifies a push job as a notification job', () => {
    expect(isNotificationJob(pushJob)).toBe(true);
    expect(isFinanceJob(pushJob)).toBe(false);
    expect(isAnalyticsJob(pushJob)).toBe(false);
    expect(isWebhookJob(pushJob)).toBe(false);
    expect(isInsightJob(pushJob)).toBe(false);
  });

  it('classifies a finance job as a finance job', () => {
    expect(isFinanceJob(financeJob)).toBe(true);
    expect(isNotificationJob(financeJob)).toBe(false);
  });

  it('exactly one guard matches for every message type in the union', () => {
    for (const type of ALL_TYPES) {
      const msg = minimalMessage(type);
      const matches = [
        isNotificationJob(msg),
        isAnalyticsJob(msg),
        isWebhookJob(msg),
        isInsightJob(msg),
        isFinanceJob(msg),
      ].filter(Boolean).length;
      expect({ type, matches }).toEqual({ type, matches: 1 });
    }
  });

  it('keeps the declared type list free of duplicates', () => {
    expect(new Set(ALL_TYPES).size).toBe(ALL_TYPES.length);
  });
});

// ─── Auth contracts ─────────────────────────────────────────────────────────

describe('auth contracts', () => {
  const user: UserSummary = {
    id: '55555555-5555-4555-8555-555555555555',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'USER',
    isVerified: false,
    isActive: true,
    createdAt: '2026-10-05T12:00:00.000Z',
    updatedAt: '2026-10-05T12:00:00.000Z',
  };

  const loginResponse: LoginResponse = {
    user,
    accessToken: 'header.payload.signature',
    refreshToken: 'refresh-token',
    expiresIn: 900,
  };

  it('round-trips a LoginResponse through JSON', () => {
    const restored = JSON.parse(JSON.stringify(loginResponse)) as LoginResponse;
    expect(restored).toEqual(loginResponse);
    expect(restored.user.email).toBe('ada@example.com');
    expect(restored.expiresIn).toBe(900);
  });

  it('round-trips a RegisterRequest', () => {
    const req: RegisterRequest = {
      email: 'ada@example.com',
      password: 'Str0ng!Pass',
      firstName: 'Ada',
      lastName: 'Lovelace',
    };
    expect(JSON.parse(JSON.stringify(req))).toEqual(req);
  });

  it('serializes an invalid-token ValidateTokenResponse with null claims', () => {
    const res: ValidateTokenResponse = { valid: false, claims: null, error: 'expired' };
    const restored = JSON.parse(JSON.stringify(res)) as ValidateTokenResponse;
    expect(restored.valid).toBe(false);
    expect(restored.claims).toBeNull();
    expect(restored.error).toBe('expired');
  });
});
