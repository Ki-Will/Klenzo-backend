/**
 * Structured JSON logger for Cloudflare Workers.
 * Emits to console.log — Workers stream console output to Logpush / tail.
 * No Node-specific dependencies (no pino, no winston).
 */

// ─── Types ────────────────────────────────────────────────────────────────

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  level: LogLevel;
  service: string;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  traceId?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  [key: string]: unknown;
}

export interface LoggerOptions {
  service: string;
  requestId?: string;
  userId?: string;
  traceId?: string;
  minLevel?: LogLevel;
}

// ─── Level ordering ────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

// ─── Logger class ─────────────────────────────────────────────────────────

export class Logger {
  private readonly service: string;
  private requestId?: string;
  private userId?: string;
  private traceId?: string;
  private readonly minLevel: LogLevel;

  constructor(options: LoggerOptions) {
    this.service = options.service;
    this.requestId = options.requestId;
    this.userId = options.userId;
    this.traceId = options.traceId;
    this.minLevel = options.minLevel ?? LogLevel.INFO;
  }

  /**
   * Return a child logger with additional context bound.
   */
  child(ctx: Partial<Pick<LoggerOptions, 'requestId' | 'userId' | 'traceId'>>): Logger {
    const child = new Logger({
      service: this.service,
      requestId: ctx.requestId ?? this.requestId,
      userId: ctx.userId ?? this.userId,
      traceId: ctx.traceId ?? this.traceId,
      minLevel: this.minLevel,
    });
    return child;
  }

  /**
   * Bind a request ID to this logger instance (in-place mutation for convenience).
   */
  setRequestId(requestId: string): this {
    this.requestId = requestId;
    return this;
  }

  /**
   * Bind a user ID to this logger instance.
   */
  setUserId(userId: string): this {
    this.userId = userId;
    return this;
  }

  // ─── Log methods ────────────────────────────────────────────────────────

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, err?: unknown, context?: Record<string, unknown>): void {
    const errorContext = err ? { error: serializeError(err) } : {};
    this.log(LogLevel.ERROR, message, { ...errorContext, ...context });
  }

  /**
   * Log a request/response cycle with duration.
   */
  request(
    method: string,
    path: string,
    status: number,
    durationMs: number,
    context?: Record<string, unknown>,
  ): void {
    this.log(LogLevel.INFO, `${method} ${path} ${status}`, {
      http: { method, path, status, durationMs },
      ...context,
    });
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;

    const entry: LogEntry = {
      level,
      service: this.service,
      message,
      timestamp: new Date().toISOString(),
      ...(this.requestId && { requestId: this.requestId }),
      ...(this.userId && { userId: this.userId }),
      ...(this.traceId && { traceId: this.traceId }),
      ...context,
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }
}

// ─── Error serialization ─────────────────────────────────────────────────────

function serializeError(err: unknown): LogEntry['error'] {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: (err as Error & { code?: string }).code,
    };
  }
  if (typeof err === 'string') {
    return { name: 'Error', message: err };
  }
  return { name: 'UnknownError', message: String(err) };
}

// ─── Factory ──────────────────────────────────────────────────────────────

/**
 * Create a logger for a specific service.
 */
export function createLogger(
  service: string,
  options?: Partial<Omit<LoggerOptions, 'service'>>,
): Logger {
  return new Logger({ service, ...options });
}
