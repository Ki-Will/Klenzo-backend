import { z } from 'zod';

// ─── UUID ──────────────────────────────────────────────────────────────────

export const UuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

export type Uuid = z.infer<typeof UuidSchema>;

// ─── Date Range ────────────────────────────────────────────────────────────

export const DateRangeSchema = z
  .object({
    startDate: z.string().datetime({ message: 'startDate must be ISO 8601' }),
    endDate: z.string().datetime({ message: 'endDate must be ISO 8601' }),
  })
  .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
    message: 'startDate must be before or equal to endDate',
    path: ['startDate'],
  });

export type DateRange = z.infer<typeof DateRangeSchema>;

// ─── Currency ──────────────────────────────────────────────────────────────

export const CurrencySchema = z.enum(['USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES', 'ZAR'], {
  errorMap: () => ({ message: 'Unsupported currency code' }),
});

export type Currency = z.infer<typeof CurrencySchema>;

// ─── Decimal Amount ─────────────────────────────────────────────────────────

export const DecimalAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,8})?$/, 'Amount must be a positive decimal string (e.g. "100.00")');

export type DecimalAmount = z.infer<typeof DecimalAmountSchema>;

// ─── Phone Number ─────────────────────────────────────────────────────────

export const PhoneNumberSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 format (e.g. +2348012345678)');

// ─── validateOrThrow ──────────────────────────────────────────────────────

/**
 * Validates data against a Zod schema, throwing a structured error on failure.
 * Worker-compatible — no Node-specific APIs.
 *
 * @throws {{ issues: z.ZodIssue[] }} Validation error with field-level issues
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const error = new Error('Validation failed') as Error & {
      issues: z.ZodIssue[];
      statusCode: number;
    };
    error.issues = result.error.issues;
    error.statusCode = 400;
    throw error;
  }
  return result.data;
}

/**
 * Validates data and returns either the parsed value or the errors.
 * Never throws.
 */
export function validateSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; issues: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, issues: result.error.issues };
}
