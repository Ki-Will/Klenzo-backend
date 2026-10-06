import { Prisma } from '@prisma/client';

// ── Domain Error Classes ────────────────────────────────────────────────────

/**
 * Base class for all database-layer errors.
 * Carries the original cause for upstream logging/tracing.
 */
export class DatabaseError extends Error {
  public readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'DatabaseError';
    this.cause = cause;
    // Restore prototype chain for instanceof checks in transpiled environments
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a requested record does not exist (Prisma P2025).
 */
export class RecordNotFoundError extends DatabaseError {
  public readonly model?: string;

  constructor(message: string, cause?: unknown, model?: string) {
    super(message, cause);
    this.name = 'RecordNotFoundError';
    this.model = model;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a unique constraint is violated (Prisma P2002).
 */
export class UniqueConstraintError extends DatabaseError {
  /** The fields that caused the violation, if available. */
  public readonly fields?: string[];

  constructor(message: string, cause?: unknown, fields?: string[]) {
    super(message, cause);
    this.name = 'UniqueConstraintError';
    this.fields = fields;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a transaction fails or is explicitly aborted.
 */
export class TransactionError extends DatabaseError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'TransactionError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Type guard ──────────────────────────────────────────────────────────────

/**
 * Returns true if `err` is a Prisma-originated error
 * (either a PrismaClientKnownRequestError or PrismaClientUnknownRequestError).
 */
export function isPrismaError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientValidationError
  );
}

// ── Error mapper ────────────────────────────────────────────────────────────

/**
 * Converts a raw Prisma error (or any unknown thrown value) into a typed
 * domain error and re-throws it. Call from catch blocks.
 *
 * @example
 * try {
 *   await prisma.user.create({ data })
 * } catch (err) {
 *   handlePrismaError(err)  // always throws
 * }
 */
export function handlePrismaError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        // Unique constraint failed
        const meta = err.meta as { target?: string[] } | undefined;
        const fields = meta?.target;
        throw new UniqueConstraintError(
          `Unique constraint failed on field(s): ${fields?.join(', ') ?? 'unknown'}`,
          err,
          fields,
        );
      }

      case 'P2025': {
        // Record not found (delete/update on non-existent record)
        const meta = err.meta as { modelName?: string; cause?: string } | undefined;
        const model = meta?.modelName;
        throw new RecordNotFoundError(
          meta?.cause ?? `Record not found${model ? ` in model: ${model}` : ''}`,
          err,
          model,
        );
      }

      case 'P2003': {
        // Foreign key constraint failed
        const meta = err.meta as { field_name?: string } | undefined;
        throw new DatabaseError(
          `Foreign key constraint failed on field: ${meta?.field_name ?? 'unknown'}`,
          err,
        );
      }

      case 'P2034': {
        // Transaction conflict / write conflict under serializable isolation
        throw new TransactionError('Transaction conflict — please retry the operation', err);
      }

      default:
        throw new DatabaseError(`Prisma error [${err.code}]: ${err.message}`, err);
    }
  }

  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    throw new DatabaseError(`Unknown Prisma request error: ${err.message}`, err);
  }

  if (err instanceof Prisma.PrismaClientRustPanicError) {
    throw new DatabaseError(`Prisma engine panic: ${err.message}`, err);
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    throw new DatabaseError(`Prisma initialization error: ${err.message}`, err);
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    throw new DatabaseError(`Prisma validation error: ${err.message}`, err);
  }

  // Non-Prisma error — re-wrap for a uniform type at the boundary
  if (err instanceof Error) {
    throw new DatabaseError(err.message, err);
  }

  throw new DatabaseError('An unexpected database error occurred', err);
}
