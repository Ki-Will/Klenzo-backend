// ─── Types ────────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
}

export interface CursorPaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Convert page/pageSize to SQL limit/offset values.
 */
export function toSqlPagination(params: PaginationParams): { limit: number; offset: number } {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  return {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

/**
 * Construct a PaginatedResult from an array, total count, and pagination params.
 * Does NOT slice the array — data should already be the current page's items.
 */
export function paginate<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Construct a CursorPaginatedResult.
 * Pass `limit + 1` items to this function; it will detect whether more exist.
 */
export function cursorPaginate<T, K extends keyof T>(
  items: T[],
  limit: number,
  cursorField: K,
): CursorPaginatedResult<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? String(data[data.length - 1][cursorField]) : undefined;

  return { data, nextCursor, hasMore };
}

/**
 * Normalize pagination params with defaults.
 */
export function normalizePagination(
  page?: number | string,
  pageSize?: number | string,
  maxPageSize = 100,
): PaginationParams {
  return {
    page: Math.max(1, Number(page) || 1),
    pageSize: Math.min(maxPageSize, Math.max(1, Number(pageSize) || 20)),
  };
}
