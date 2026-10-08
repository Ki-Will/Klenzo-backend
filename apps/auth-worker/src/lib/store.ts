/**
 * User persistence for auth-worker.
 *
 * Route handlers depend only on the narrow `UserStore` interface; the real
 * implementation is a thin adapter over the Prisma client (@klenzo/database,
 * pg adapter — Hyperdrive-compatible), and tests inject `memoryUserStore()`.
 */

import type { PrismaClient, User, Prisma } from '@klenzo/database';

/** Full auth.users row (Prisma model). */
export type UserRecord = User;

/** Subset of columns the auth flows ever write. */
export type UserUpdateData = Partial<
  Pick<
    UserRecord,
    | 'email'
    | 'passwordHash'
    | 'failedLoginAttempts'
    | 'isActive'
    | 'lastLogin'
    | 'refreshToken'
    | 'refreshTokenExpires'
    | 'passwordResetToken'
    | 'passwordResetExpires'
    | 'name'
    | 'phone'
    | 'avatar'
    | 'notificationSettings'
    | 'mfaSecret'
    | 'mfaEnabled'
  >
>;

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name?: string | null;
  phone?: string | null;
}

export interface UserStore {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  findByRefreshHash(hash: string): Promise<UserRecord | null>;
  create(data: CreateUserInput): Promise<UserRecord>;
  update(id: string, data: UserUpdateData): Promise<UserRecord>;
}

// ── Prisma adapter ───────────────────────────────────────────────────────────

export function prismaUserStore(client: PrismaClient): UserStore {
  return {
    findByEmail: (email) => client.user.findUnique({ where: { email } }),
    findById: (id) => client.user.findUnique({ where: { id } }),
    findByRefreshHash: (hash) =>
      client.user.findFirst({ where: { refreshToken: hash } }),
    create: (data) => client.user.create({ data }),
    update: (id, data) =>
      client.user.update({
        where: { id },
        // UserUpdateData is a structural subset of Prisma's update input;
        // nullability of Json fields differs between the two typings.
        data: data as unknown as Prisma.UserUpdateInput,
      }),
  };
}

/**
 * Defer store construction until the first query — lets `/health` respond
 * even when no database binding/secret has been configured yet.
 */
export function lazyUserStore(resolve: () => UserStore): UserStore {
  return {
    findByEmail: (email) => resolve().findByEmail(email),
    findById: (id) => resolve().findById(id),
    findByRefreshHash: (hash) => resolve().findByRefreshHash(hash),
    create: (data) => resolve().create(data),
    update: (id, data) => resolve().update(id, data),
  };
}

// ── In-memory test double ────────────────────────────────────────────────────

export interface MemoryUserStore extends UserStore {
  rows: Map<string, UserRecord>;
}

export function memoryUserStore(): MemoryUserStore {
  const rows = new Map<string, UserRecord>();

  return {
    rows,
    async findByEmail(email) {
      for (const user of rows.values()) {
        if (user.email === email) return user;
      }
      return null;
    },
    async findById(id) {
      return rows.get(id) ?? null;
    },
    async findByRefreshHash(hash) {
      for (const user of rows.values()) {
        if (user.refreshToken === hash) return user;
      }
      return null;
    },
    async create(data) {
      const now = new Date();
      const user: UserRecord = {
        id: crypto.randomUUID(),
        email: data.email,
        passwordHash: data.passwordHash,
        createdAt: now,
        updatedAt: now,
        lastLogin: null,
        isActive: true,
        refreshToken: null,
        refreshTokenExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        role: 'USER',
        name: data.name ?? null,
        phone: data.phone ?? null,
        avatar: null,
        notificationSettings: null,
        googleId: null,
        mfaSecret: null,
        mfaEnabled: false,
      };
      rows.set(user.id, user);
      return user;
    },
    async update(id, data) {
      const existing = rows.get(id);
      if (!existing) throw new Error(`User ${id} not found`);
      const next: UserRecord = { ...existing, ...data, updatedAt: new Date() };
      rows.set(id, next);
      return next;
    },
  };
}

// ── Legacy response helper ───────────────────────────────────────────────────

/**
 * Legacy `safeUser` — the exact field-stripping the NestJS auth service
 * performs before returning a user to the frontend.
 */
export function toSafeUser(user: UserRecord): Omit<
  UserRecord,
  'passwordHash' | 'refreshToken' | 'passwordResetToken'
> {
  const { passwordHash, refreshToken, passwordResetToken, ...safe } = user;
  void passwordHash;
  void refreshToken;
  void passwordResetToken;
  return safe;
}
