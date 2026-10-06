// ─── Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ErrorResponseBody;
  meta?: ResponseMeta;
}

export interface SuccessResponse<T> extends ApiResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponseBody {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  timestamp?: string;
}

export interface ResponseMeta {
  requestId?: string;
  timestamp?: string;
  version?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ─── Factory helpers ──────────────────────────────────────────────────────

/**
 * Create a success response envelope.
 */
export function createSuccess<T>(data: T, meta?: ResponseMeta): SuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/**
 * Create an error response envelope.
 */
export function createError(
  code: string,
  message: string,
  details?: unknown,
  requestId?: string,
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create a paginated success response with meta included.
 */
export function createPaginatedSuccess<T>(
  data: T[],
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  },
  requestId?: string,
): SuccessResponse<T[]> {
  return {
    success: true,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      pagination,
    },
  };
}
