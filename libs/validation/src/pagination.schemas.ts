import { z } from 'zod';

// ─── Pagination ────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce
    .number()
    .int('page must be an integer')
    .min(1, 'page must be at least 1')
    .default(1),
  pageSize: z.coerce
    .number()
    .int('pageSize must be an integer')
    .min(1, 'pageSize must be at least 1')
    .max(100, 'pageSize cannot exceed 100')
    .default(20),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

// ─── Sort ──────────────────────────────────────────────────────────────────

export const SortOrderSchema = z.enum(['asc', 'desc']).default('desc');
export type SortOrder = z.infer<typeof SortOrderSchema>;

export const SortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: SortOrderSchema.optional(),
});

export type SortInput = z.infer<typeof SortSchema>;

// ─── Combined Pagination + Sort ────────────────────────────────────────────

export const PaginatedQuerySchema = PaginationSchema.merge(SortSchema);
export type PaginatedQueryInput = z.infer<typeof PaginatedQuerySchema>;

// ─── Cursor Pagination ─────────────────────────────────────────────────────

export const CursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  direction: z.enum(['forward', 'backward']).default('forward'),
});

export type CursorPaginationInput = z.infer<typeof CursorPaginationSchema>;
