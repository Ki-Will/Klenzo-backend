/**
 * Database seeding factory system.
 * Provides reusable factories for generating test data.
 *
 * Usage:
 *   const user = UserFactory.create({ email: 'test@example.com' });
 *   const transaction = TransactionFactory.create({ userId: user.id });
 */

import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

// ── User Factory ──────────────────────────────────────────────────────────

export interface UserFactoryInput {
  id?: string;
  email?: string;
  password?: string;
  name?: string;
  role?: 'USER' | 'ADMIN' | 'SUPERADMIN';
  isActive?: boolean;
}

export const UserFactory = {
  create: async (overrides: UserFactoryInput = {}) => {
    const defaults: UserFactoryInput = {
      id: crypto.randomUUID(),
      email: `user-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Test User',
      role: 'USER',
      isActive: true,
    };

    const input = { ...defaults, ...overrides };
    const passwordHash = await bcrypt.hash(input.password!, 10);

    return {
      id: input.id,
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
      isActive: input.isActive,
    };
  },
};

// ── Transaction Factory ───────────────────────────────────────────────────

export interface TransactionFactoryInput {
  id?: string;
  userId?: string;
  amount?: number;
  description?: string;
  category?: string;
  transactionType?: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'PAYROLL';
  status?: 'PENDING' | 'APPROVED' | 'FAILED' | 'REJECTED';
  date?: Date;
}

export const TransactionFactory = {
  create: (overrides: TransactionFactoryInput = {}) => {
    const defaults: TransactionFactoryInput = {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      amount: Math.round(Math.random() * 1000 * 100) / 100,
      description: 'Test transaction',
      category: 'food',
      transactionType: 'EXPENSE',
      status: 'APPROVED',
      date: new Date(),
    };

    return { ...defaults, ...overrides };
  },

  createMany: (count: number, overrides: TransactionFactoryInput = {}) => {
    return Array.from({ length: count }, () => TransactionFactory.create(overrides));
  },
};

// ── Wallet Factory ────────────────────────────────────────────────────────

export interface WalletFactoryInput {
  id?: string;
  userId?: string;
  name?: string;
  currency?: string;
  balance?: number;
  accountNumber?: string;
  isPrimary?: boolean;
}

export const WalletFactory = {
  create: (overrides: WalletFactoryInput = {}) => {
    const defaults: WalletFactoryInput = {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      name: 'Main Wallet',
      currency: 'USD',
      balance: Math.round(Math.random() * 10000 * 100) / 100,
      accountNumber: `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      isPrimary: true,
    };

    return { ...defaults, ...overrides };
  },
};

// ── Habit Factory ─────────────────────────────────────────────────────────

export interface HabitFactoryInput {
  id?: string;
  userId?: string;
  name?: string;
  description?: string;
  frequency?: 'DAILY' | 'WEEKLY';
  currentStreak?: number;
  longestStreak?: number;
}

export const HabitFactory = {
  create: (overrides: HabitFactoryInput = {}) => {
    const defaults: HabitFactoryInput = {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      name: 'Morning Meditation',
      description: '10 minutes of mindfulness',
      frequency: 'DAILY',
      currentStreak: Math.floor(Math.random() * 30),
      longestStreak: Math.floor(Math.random() * 100),
    };

    return { ...defaults, ...overrides };
  },
};

// ── Task Factory ──────────────────────────────────────────────────────────

export interface TaskFactoryInput {
  id?: string;
  userId?: string;
  title?: string;
  description?: string;
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  priority?: number;
  dueDate?: Date;
}

export const TaskFactory = {
  create: (overrides: TaskFactoryInput = {}) => {
    const defaults: TaskFactoryInput = {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      title: 'Test task',
      description: 'Test description',
      status: 'TODO',
      priority: Math.floor(Math.random() * 5),
      dueDate: new Date(Date.now() + Math.random() * 30 * 86400000),
    };

    return { ...defaults, ...overrides };
  },
};
