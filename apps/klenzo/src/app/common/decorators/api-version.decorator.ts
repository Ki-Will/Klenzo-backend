import { SetMetadata } from '@nestjs/common';

/**
 * API Version decorator.
 * Usage: @ApiVersion('v1')
 */
export const API_VERSION_KEY = 'apiVersion';
export const ApiVersion = (version: string) =>
  SetMetadata(API_VERSION_KEY, version);

/**
 * Pagination interface for API responses.
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Pagination DTO for query parameters.
 */
export class PaginationDto {
  page?: number = 1;
  limit?: number = 20;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' = 'desc';
}

/**
 * Helper to create paginated responses.
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Cache-Control decorator for API response caching.
 * Usage: @CacheControl('public, max-age=60, stale-while-revalidate=300')
 */
export const CACHE_CONTROL_KEY = 'cacheControl';
export const CacheControl = (policy: string) =>
  SetMetadata(CACHE_CONTROL_KEY, policy);
