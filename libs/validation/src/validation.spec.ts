/**
 * Schema validation tests for @klenzo/validation (Phase 2 contract tests).
 *
 * Covers: valid input acceptance, invalid-input rejection, defaulting,
 * coercion, normalization, and the validateOrThrow/validateSafe helpers.
 */

import {
  RegisterSchema,
  LoginSchema,
  ChangePasswordSchema,
  RefreshTokenSchema,
} from './auth.schemas';
import {
  PaginationSchema,
  PaginatedQuerySchema,
  CursorPaginationSchema,
} from './pagination.schemas';
import { CreateHabitSchema, LogHabitSchema } from './habit.schemas';
import {
  CreateTransactionSchema,
  CreateTransferSchema,
  CreateBudgetSchema,
} from './finance.schemas';
import {
  CurrencySchema,
  DecimalAmountSchema,
  PhoneNumberSchema,
  UuidSchema,
  DateRangeSchema,
  validateOrThrow,
  validateSafe,
} from './common';

const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const validRegister = {
  email: '  User@Example.COM ',
  password: 'Str0ng!Pass',
  firstName: 'Ada',
  lastName: 'Lovelace',
};

// ─── Auth schemas ───────────────────────────────────────────────────────────

describe('RegisterSchema', () => {
  it('accepts a valid registration and normalizes the email', () => {
    const result = RegisterSchema.safeParse(validRegister);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
      expect(result.data.firstName).toBe('Ada');
    }
  });

  it('accepts a registration without an optional phone number', () => {
    expect(RegisterSchema.safeParse(validRegister).success).toBe(true);
  });

  it('accepts an E.164 phone number', () => {
    const result = RegisterSchema.safeParse({
      ...validRegister,
      phoneNumber: '+2348012345678',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-E.164 phone number', () => {
    const result = RegisterSchema.safeParse({
      ...validRegister,
      phoneNumber: '08012345678',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(
      RegisterSchema.safeParse({ ...validRegister, email: 'not-an-email' }).success,
    ).toBe(false);
  });

  it.each([
    ['too short', 'Ab1!xyz'],
    ['missing uppercase', 'str0ng!pass'],
    ['missing lowercase', 'STR0NG!PASS'],
    ['missing number', 'Strong!Pass'],
    ['missing special char', 'StrongPass1'],
  ])('rejects a password %s', (_label, password) => {
    expect(RegisterSchema.safeParse({ ...validRegister, password }).success).toBe(false);
  });

  it('rejects missing first/last name', () => {
    expect(
      RegisterSchema.safeParse({ ...validRegister, firstName: '   ' }).success,
    ).toBe(false);
    expect(RegisterSchema.safeParse({ ...validRegister, lastName: '' }).success).toBe(
      false,
    );
  });
});

describe('LoginSchema', () => {
  it('accepts valid credentials', () => {
    expect(
      LoginSchema.safeParse({ email: 'user@example.com', password: 'whatever' })
        .success,
    ).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(LoginSchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(
      false,
    );
  });

  it('rejects a missing email', () => {
    expect(LoginSchema.safeParse({ password: 'x' }).success).toBe(false);
  });
});

describe('ChangePasswordSchema', () => {
  const valid = {
    currentPassword: 'OldPass1!',
    newPassword: 'NewPass2!',
    confirmNewPassword: 'NewPass2!',
  };

  it('accepts a matching, sufficiently strong new password', () => {
    expect(ChangePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects mismatched confirmation', () => {
    expect(
      ChangePasswordSchema.safeParse({ ...valid, confirmNewPassword: 'Different1!' })
        .success,
    ).toBe(false);
  });

  it('rejects reusing the current password', () => {
    expect(
      ChangePasswordSchema.safeParse({
        currentPassword: 'OldPass1!',
        newPassword: 'OldPass1!',
        confirmNewPassword: 'OldPass1!',
      }).success,
    ).toBe(false);
  });
});

describe('RefreshTokenSchema', () => {
  it('rejects an empty refresh token', () => {
    expect(RefreshTokenSchema.safeParse({ refreshToken: '' }).success).toBe(false);
  });
});

// ─── Pagination schemas ─────────────────────────────────────────────────────

describe('PaginationSchema', () => {
  it('applies defaults for an empty query', () => {
    const result = PaginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ page: 1, pageSize: 20 });
    }
  });

  it('coerces query-string numbers', () => {
    const result = PaginationSchema.safeParse({ page: '3', pageSize: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ page: 3, pageSize: 50 });
    }
  });

  it('rejects page below 1', () => {
    expect(PaginationSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('rejects pageSize above 100', () => {
    expect(PaginationSchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it('rejects non-integer values', () => {
    expect(PaginationSchema.safeParse({ page: 1.5 }).success).toBe(false);
  });
});

describe('PaginatedQuerySchema', () => {
  it('merges sort options with pagination', () => {
    const result = PaginatedQuerySchema.safeParse({
      page: 2,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid sort order', () => {
    expect(PaginatedQuerySchema.safeParse({ sortOrder: 'sideways' }).success).toBe(false);
  });
});

describe('CursorPaginationSchema', () => {
  it('defaults limit and direction', () => {
    const result = CursorPaginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ limit: 20, direction: 'forward' });
    }
  });

  it('rejects limit above 100', () => {
    expect(CursorPaginationSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

// ─── Habit schemas ──────────────────────────────────────────────────────────

describe('CreateHabitSchema', () => {
  const valid = { name: 'Read', frequency: 'DAILY' as const };

  it('accepts a minimal habit and defaults targetCount to 1', () => {
    const result = CreateHabitSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetCount).toBe(1);
    }
  });

  it('accepts a fully specified habit', () => {
    const result = CreateHabitSchema.safeParse({
      ...valid,
      description: 'Read 20 pages',
      targetCount: 3,
      color: '#FF5733',
      icon: 'book',
      reminderTime: '21:30',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown frequency', () => {
    expect(CreateHabitSchema.safeParse({ ...valid, frequency: 'HOURLY' }).success).toBe(
      false,
    );
  });

  it('rejects a malformed color', () => {
    expect(CreateHabitSchema.safeParse({ ...valid, color: 'red' }).success).toBe(false);
  });

  it('rejects a malformed reminder time', () => {
    expect(CreateHabitSchema.safeParse({ ...valid, reminderTime: '25:99' }).success).toBe(
      false,
    );
  });

  it('rejects an empty name', () => {
    expect(CreateHabitSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
  });
});

describe('LogHabitSchema', () => {
  it('accepts a valid log entry', () => {
    expect(
      LogHabitSchema.safeParse({
        status: 'COMPLETED',
        scheduledDate: '2026-10-05',
        completedAt: '2026-10-05T21:30:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('rejects a non-YYYY-MM-DD scheduled date', () => {
    expect(
      LogHabitSchema.safeParse({ status: 'COMPLETED', scheduledDate: '05/10/2026' })
        .success,
    ).toBe(false);
  });
});

// ─── Finance schemas ────────────────────────────────────────────────────────

describe('CreateTransactionSchema', () => {
  const valid = {
    walletId: VALID_UUID,
    type: 'DEBIT' as const,
    amount: '125.50',
    currency: 'USD' as const,
  };

  it('accepts a valid transaction', () => {
    expect(CreateTransactionSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid wallet UUID', () => {
    expect(CreateTransactionSchema.safeParse({ ...valid, walletId: 'nope' }).success).toBe(
      false,
    );
  });

  it('rejects a negative amount', () => {
    expect(CreateTransactionSchema.safeParse({ ...valid, amount: '-10.00' }).success).toBe(
      false,
    );
  });

  it('rejects an unsupported currency', () => {
    expect(CreateTransactionSchema.safeParse({ ...valid, currency: 'XYZ' }).success).toBe(
      false,
    );
  });

  it('rejects an unknown transaction type', () => {
    expect(CreateTransactionSchema.safeParse({ ...valid, type: 'MAGIC' }).success).toBe(
      false,
    );
  });
});

describe('CreateTransferSchema', () => {
  it('rejects transferring to the same wallet', () => {
    const result = CreateTransferSchema.safeParse({
      fromWalletId: VALID_UUID,
      toWalletId: VALID_UUID,
      amount: '10.00',
      currency: 'USD',
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateBudgetSchema', () => {
  it('rejects an endDate before the startDate', () => {
    const result = CreateBudgetSchema.safeParse({
      name: 'Groceries',
      amount: '200.00',
      currency: 'USD',
      period: 'MONTHLY',
      startDate: '2026-10-31T00:00:00.000Z',
      endDate: '2026-10-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

// ─── Common primitives ──────────────────────────────────────────────────────

describe('common schemas', () => {
  it('validates UUIDs', () => {
    expect(UuidSchema.safeParse(VALID_UUID).success).toBe(true);
    expect(UuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });

  it('validates decimal amount strings', () => {
    expect(DecimalAmountSchema.safeParse('100.00000001').success).toBe(true);
    expect(DecimalAmountSchema.safeParse('10.').success).toBe(false);
    expect(DecimalAmountSchema.safeParse('abc').success).toBe(false);
  });

  it('validates supported currencies', () => {
    expect(CurrencySchema.safeParse('NGN').success).toBe(true);
    expect(CurrencySchema.safeParse('XYZ').success).toBe(false);
  });

  it('validates E.164 phone numbers', () => {
    expect(PhoneNumberSchema.safeParse('+2348012345678').success).toBe(true);
    expect(PhoneNumberSchema.safeParse('2348012345678').success).toBe(false);
  });

  it('rejects a date range where the start is after the end', () => {
    expect(
      DateRangeSchema.safeParse({
        startDate: '2026-10-10T00:00:00.000Z',
        endDate: '2026-10-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

describe('validateOrThrow', () => {
  it('returns parsed data for valid input', () => {
    const data = validateOrThrow(PaginationSchema, { page: 2 });
    expect(data).toEqual({ page: 2, pageSize: 20 });
  });

  it('throws a 400 error with field-level issues for invalid input', () => {
    try {
      validateOrThrow(PaginationSchema, { page: 0 });
      throw new Error('should have thrown');
    } catch (err) {
      const e = err as Error & { issues?: unknown[]; statusCode?: number };
      expect(e.message).toBe('Validation failed');
      expect(e.statusCode).toBe(400);
      expect(Array.isArray(e.issues)).toBe(true);
      expect((e.issues as unknown[]).length).toBeGreaterThan(0);
    }
  });
});

describe('validateSafe', () => {
  it('never throws — returns success with data', () => {
    const result = validateSafe(LoginSchema, {
      email: 'user@example.com',
      password: 'x',
    });
    expect(result.success).toBe(true);
  });

  it('never throws — returns issues on failure', () => {
    const result = validateSafe(LoginSchema, { email: 'nope', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
});
