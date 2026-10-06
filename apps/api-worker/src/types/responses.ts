/**
 * Standard response envelope types and factory helpers for api-worker.
 *
 * All HTTP responses should be shaped through these helpers so consumers
 * get a consistent contract regardless of which route produced the data.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** Successful response wrapper. */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  requestId: string;
  timestamp: string;
}

/** Error response wrapper. */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
  timestamp: string;
}

/** Paginated response wrapper (extends ApiResponse). */
export interface PaginatedResponse<T = unknown> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  requestId: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Build a successful response envelope.
 *
 * @param data      - The response payload.
 * @param requestId - The X-Request-Id for the current request.
 */
export function successResponse<T>(data: T, requestId: string): ApiResponse<T> {
  return {
    success: true,
    data,
    requestId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build an error response envelope.
 *
 * @param code      - A machine-readable error code string (e.g. "NOT_FOUND").
 * @param message   - A human-readable error message.
 * @param requestId - The X-Request-Id for the current request.
 * @param details   - Optional extra context (validation errors, upstream info, …).
 */
export function errorResponse(
  code: string,
  message: string,
  requestId: string,
  details?: unknown,
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    requestId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a paginated response envelope.
 *
 * @param data      - The page of items.
 * @param page      - Current page number (1-based).
 * @param pageSize  - Number of items per page.
 * @param total     - Total number of items across all pages.
 * @param requestId - The X-Request-Id for the current request.
 */
export function paginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number,
  requestId: string,
): PaginatedResponse<T> {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
    requestId,
    timestamp: new Date().toISOString(),
  };
}
