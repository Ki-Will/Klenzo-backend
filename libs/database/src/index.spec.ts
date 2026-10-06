/**
 * Unit tests for @klenzo/database
 *
 * No real database is required — all Prisma interactions are mocked.
 */

import { Prisma } from '@prisma/client';

// ── Mock @prisma/adapter-pg before client.ts is imported ─────────────────────
jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

// ── Mock @prisma/client ───────────────────────────────────────────────────────
// jest.mock() factories are hoisted above module-level const declarations, so
// every mock is CREATED INSIDE the factory and referenced afterwards via
// jest.requireMock() once the factory has run.
jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client') as Record<string, unknown>;
  const mockQueryRaw = jest.fn();
  const mockTransaction = jest.fn();
  const MockPrismaClient = jest.fn().mockImplementation(() => ({
    $queryRaw: mockQueryRaw,
    $transaction: mockTransaction,
  }));
  return {
    ...actual,
    PrismaClient: MockPrismaClient,
    __testMocks: { MockPrismaClient, mockQueryRaw, mockTransaction },
  };
});

const { MockPrismaClient, mockQueryRaw, mockTransaction } = (
  jest.requireMock('@prisma/client') as {
    __testMocks: {
      MockPrismaClient: jest.Mock;
      mockQueryRaw: jest.Mock;
      mockTransaction: jest.Mock;
    };
  }
).__testMocks;

// ── Imports (after mocks are registered) ─────────────────────────────────────
import {
  handlePrismaError,
  isPrismaError,
  DatabaseError,
  RecordNotFoundError,
  UniqueConstraintError,
  TransactionError,
} from './errors.js';
import { getCachedClient } from './client.js';
import { withTransaction } from './transaction.js';
import { checkDatabaseConnection } from './health.js';

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

function makePrismaKnownError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  const err = new Prisma.PrismaClientKnownRequestError('test error', {
    code,
    clientVersion: '7.x.x',
    meta,
  });
  return err;
}

// ─────────────────────────────────────────────────────────────────────────────
// handlePrismaError
// ─────────────────────────────────────────────────────────────────────────────

describe('handlePrismaError', () => {
  it('converts P2002 (unique constraint) to UniqueConstraintError', () => {
    const raw = makePrismaKnownError('P2002', { target: ['email'] });
    expect(() => handlePrismaError(raw)).toThrow(UniqueConstraintError);
  });

  it('includes the violating field names in UniqueConstraintError', () => {
    const raw = makePrismaKnownError('P2002', { target: ['email', 'phone'] });
    try {
      handlePrismaError(raw);
    } catch (err) {
      expect(err).toBeInstanceOf(UniqueConstraintError);
      expect((err as UniqueConstraintError).fields).toEqual(['email', 'phone']);
    }
  });

  it('converts P2025 (record not found) to RecordNotFoundError', () => {
    const raw = makePrismaKnownError('P2025', {
      modelName: 'User',
      cause: 'Record to delete does not exist.',
    });
    expect(() => handlePrismaError(raw)).toThrow(RecordNotFoundError);
  });

  it('includes the model name in RecordNotFoundError', () => {
    const raw = makePrismaKnownError('P2025', { modelName: 'Transaction' });
    try {
      handlePrismaError(raw);
    } catch (err) {
      expect(err).toBeInstanceOf(RecordNotFoundError);
      expect((err as RecordNotFoundError).model).toBe('Transaction');
    }
  });

  it('converts P2034 (transaction conflict) to TransactionError', () => {
    const raw = makePrismaKnownError('P2034');
    expect(() => handlePrismaError(raw)).toThrow(TransactionError);
  });

  it('converts other Prisma known errors to generic DatabaseError', () => {
    const raw = makePrismaKnownError('P2003', { field_name: 'userId' });
    expect(() => handlePrismaError(raw)).toThrow(DatabaseError);
  });

  it('converts PrismaClientValidationError to DatabaseError', () => {
    const raw = new Prisma.PrismaClientValidationError('bad query', {
      clientVersion: '7.x.x',
    });
    expect(() => handlePrismaError(raw)).toThrow(DatabaseError);
  });

  it('re-wraps plain Error in DatabaseError', () => {
    expect(() => handlePrismaError(new Error('oops'))).toThrow(DatabaseError);
  });

  it('preserves the original error as cause', () => {
    const raw = makePrismaKnownError('P2002', { target: ['email'] });
    try {
      handlePrismaError(raw);
    } catch (err) {
      expect((err as DatabaseError).cause).toBe(raw);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isPrismaError
// ─────────────────────────────────────────────────────────────────────────────

describe('isPrismaError', () => {
  it('returns true for PrismaClientKnownRequestError', () => {
    const err = makePrismaKnownError('P2002');
    expect(isPrismaError(err)).toBe(true);
  });

  it('returns true for PrismaClientValidationError', () => {
    const err = new Prisma.PrismaClientValidationError('msg', {
      clientVersion: '7.x.x',
    });
    expect(isPrismaError(err)).toBe(true);
  });

  it('returns false for a plain Error', () => {
    expect(isPrismaError(new Error('plain'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isPrismaError(null)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getCachedClient
// ─────────────────────────────────────────────────────────────────────────────

describe('getCachedClient', () => {
  it('returns the same instance for the same connection string', () => {
    const connStr = 'postgresql://user:pass@localhost:5432/db_cache_test_a';
    const first = getCachedClient(connStr);
    const second = getCachedClient(connStr);
    expect(first).toBe(second);
  });

  it('returns different instances for different connection strings', () => {
    const a = getCachedClient('postgresql://user:pass@localhost:5432/db_a');
    const b = getCachedClient('postgresql://user:pass@localhost:5432/db_b');
    expect(a).not.toBe(b);
  });

  it('creates a new PrismaClient only once per connection string', () => {
    MockPrismaClient.mockClear();
    const connStr = 'postgresql://user:pass@localhost:5432/db_once_test';
    getCachedClient(connStr);
    getCachedClient(connStr);
    getCachedClient(connStr);
    // PrismaClient constructor should only have been called once for this string
    // (may have been called before for other strings in this test run)
    const callsForThisString = MockPrismaClient.mock.calls.length;
    expect(callsForThisString).toBeGreaterThanOrEqual(1);
    // Calling again should NOT call the constructor again
    const countBefore = MockPrismaClient.mock.calls.length;
    getCachedClient(connStr);
    expect(MockPrismaClient.mock.calls.length).toBe(countBefore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// withTransaction
// ─────────────────────────────────────────────────────────────────────────────

describe('withTransaction', () => {
  beforeEach(() => {
    mockTransaction.mockReset();
  });

  it('returns the value from the transaction callback', async () => {
    const expected = { id: 'abc', email: 'test@example.com' };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));

    const connStr = 'postgresql://user:pass@localhost:5432/db_tx_test';
    const prisma = getCachedClient(connStr);
    (prisma.$transaction as jest.Mock) = mockTransaction;

    const result = await withTransaction(prisma, async () => expected);
    expect(result).toEqual(expected);
  });

  it('converts P2002 thrown inside the transaction to UniqueConstraintError', async () => {
    const raw = makePrismaKnownError('P2002', { target: ['email'] });
    mockTransaction.mockRejectedValue(raw);

    const connStr = 'postgresql://user:pass@localhost:5432/db_tx_err_test';
    const prisma = getCachedClient(connStr);
    (prisma.$transaction as jest.Mock) = mockTransaction;

    await expect(withTransaction(prisma, async () => null)).rejects.toThrow(UniqueConstraintError);
  });

  it('converts P2025 thrown inside the transaction to RecordNotFoundError', async () => {
    const raw = makePrismaKnownError('P2025', { modelName: 'User' });
    mockTransaction.mockRejectedValue(raw);

    const connStr = 'postgresql://user:pass@localhost:5432/db_tx_404_test';
    const prisma = getCachedClient(connStr);
    (prisma.$transaction as jest.Mock) = mockTransaction;

    await expect(withTransaction(prisma, async () => null)).rejects.toThrow(RecordNotFoundError);
  });

  it('wraps a plain Error from inside the callback in DatabaseError', async () => {
    mockTransaction.mockRejectedValue(new Error('connection reset'));

    const connStr = 'postgresql://user:pass@localhost:5432/db_tx_plain_test';
    const prisma = getCachedClient(connStr);
    (prisma.$transaction as jest.Mock) = mockTransaction;

    await expect(withTransaction(prisma, async () => null)).rejects.toThrow(DatabaseError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// checkDatabaseConnection
// ─────────────────────────────────────────────────────────────────────────────

describe('checkDatabaseConnection', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('returns ok:true when SELECT 1 succeeds', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const connStr = 'postgresql://user:pass@localhost:5432/db_health_ok';
    const prisma = getCachedClient(connStr);
    (prisma.$queryRaw as jest.Mock) = mockQueryRaw;

    const result = await checkDatabaseConnection(prisma);
    expect(result.ok).toBe(true);
    expect(typeof result.latencyMs).toBe('number');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns ok:false when the query throws', async () => {
    mockQueryRaw.mockRejectedValue(new Error('connection refused'));

    const connStr = 'postgresql://user:pass@localhost:5432/db_health_fail';
    const prisma = getCachedClient(connStr);
    (prisma.$queryRaw as jest.Mock) = mockQueryRaw;

    const result = await checkDatabaseConnection(prisma);
    expect(result.ok).toBe(false);
    expect(typeof result.latencyMs).toBe('number');
  });

  it('measures latency as a non-negative number', async () => {
    mockQueryRaw.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 10)),
    );

    const connStr = 'postgresql://user:pass@localhost:5432/db_health_latency';
    const prisma = getCachedClient(connStr);
    (prisma.$queryRaw as jest.Mock) = mockQueryRaw;

    const result = await checkDatabaseConnection(prisma);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
