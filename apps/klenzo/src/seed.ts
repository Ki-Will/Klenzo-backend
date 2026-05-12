/**
 * Klenzo Database Seeder
 *
 * Seeds:
 *   - 1 superadmin
 *   - 1 admin
 *   - 3 regular users
 *   - Tasks, habits, habit logs, transactions, budgets, accounts,
 *     groups, group members, and notifications for each user
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register apps/klenzo/src/seed.ts
 *
 *   Or add to package.json scripts:
 *   "seed": "dotenv -e .env -- ts-node -r tsconfig-paths/register apps/klenzo/src/seed.ts"
 *   then run: npm run seed
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

dotenv.config();

// ── Entity imports ────────────────────────────────────────────────────────────
import { User } from './app/entities/user.entity';
import { Task, TaskStatus } from './app/entities/task.entity';
import { Habit, HabitLog } from './app/entities/habit.entity';
import { Transaction, TransactionType } from './app/entities/transaction.entity';
import { Group, GroupMember } from './app/entities/group.entity';
import { Budget } from './app/entities/budget.entity';
import { Account } from './app/entities/account.entity';
import {
  Notification,
  NotificationType,
  NotificationCategory,
} from './app/entities/notification.entity';

// ── DataSource ────────────────────────────────────────────────────────────────
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'klenzo',
  password: process.env.DB_PASSWORD || 'klenzo_password',
  database: process.env.DB_NAME || 'klenzo_db',
  entities: [User, Task, Habit, HabitLog, Transaction, Group, GroupMember, Budget, Account, Notification],
  synchronize: true,
  logging: false,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function dateOnly(d: Date): Date {
  return new Date(d.toISOString().split('T')[0]);
}

async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// ── Seed data definitions ─────────────────────────────────────────────────────

const USERS_SEED = [
  {
    email: 'superadmin@klenzo.com',
    password: 'SuperAdmin@123',
    name: 'Super Admin',
    role: 'superadmin' as const,
    phone: '+250788000001',
  },
  {
    email: 'admin@klenzo.com',
    password: 'Admin@1234',
    name: 'Platform Admin',
    role: 'admin' as const,
    phone: '+250788000002',
  },
  {
    email: 'alice@example.com',
    password: 'Alice@1234',
    name: 'Alice Uwimana',
    role: 'user' as const,
    phone: '+250788100001',
  },
  {
    email: 'bob@example.com',
    password: 'Bob@12345',
    name: 'Bob Mugisha',
    role: 'user' as const,
    phone: '+250788100002',
  },
  {
    email: 'carol@example.com',
    password: 'Carol@1234',
    name: 'Carol Ingabire',
    role: 'user' as const,
    phone: '+250788100003',
  },
];

// ── Main seeder ───────────────────────────────────────────────────────────────

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ Connected to database');

  const userRepo        = AppDataSource.getRepository(User);
  const taskRepo        = AppDataSource.getRepository(Task);
  const habitRepo       = AppDataSource.getRepository(Habit);
  const habitLogRepo    = AppDataSource.getRepository(HabitLog);
  const txRepo          = AppDataSource.getRepository(Transaction);
  const groupRepo       = AppDataSource.getRepository(Group);
  const memberRepo      = AppDataSource.getRepository(GroupMember);
  const budgetRepo      = AppDataSource.getRepository(Budget);
  const accountRepo     = AppDataSource.getRepository(Account);
  const notifRepo       = AppDataSource.getRepository(Notification);

  // ── 1. Users ──────────────────────────────────────────────────────────────
  console.log('\n👤 Seeding users...');

  const createdUsers: User[] = [];

  for (const seed of USERS_SEED) {
    const existing = await userRepo.findOne({ where: { email: seed.email } });
    if (existing) {
      console.log(`   ↩  Skipped (already exists): ${seed.email}`);
      createdUsers.push(existing);
      continue;
    }

    const user = userRepo.create({
      email: seed.email,
      passwordHash: await hash(seed.password),
      name: seed.name,
      role: seed.role,
      phone: seed.phone,
      isActive: true,
      lastLogin: daysAgo(Math.floor(Math.random() * 5)),
    });
    const saved = await userRepo.save(user);
    createdUsers.push(saved);
    console.log(`   ✔  Created [${seed.role}]: ${seed.email}  (password: ${seed.password})`);
  }

  // Regular users only (index 2–4)
  const regularUsers = createdUsers.slice(2);

  // ── 2. Tasks ──────────────────────────────────────────────────────────────
  console.log('\n📋 Seeding tasks...');

  const taskTemplates = [
    { title: 'Set up project repository',       status: TaskStatus.DONE,        priority: 8, daysOffset: -14, description: 'Initialize Git repo and configure CI/CD pipeline.' },
    { title: 'Design database schema',           status: TaskStatus.DONE,        priority: 9, daysOffset: -10, description: 'Define all tables, relations, and indexes.' },
    { title: 'Implement authentication module',  status: TaskStatus.DONE,        priority: 10, daysOffset: -7, description: 'JWT login, register, refresh, and password reset.' },
    { title: 'Build finance dashboard UI',       status: TaskStatus.IN_PROGRESS, priority: 7, daysOffset:  3, description: 'Charts for income vs expenses and category breakdown.' },
    { title: 'Write unit tests for auth',        status: TaskStatus.IN_PROGRESS, priority: 6, daysOffset:  5, description: 'Cover register, login, refresh, and edge cases.' },
    { title: 'Integrate email notifications',    status: TaskStatus.TODO,        priority: 5, daysOffset:  7, description: 'Welcome email, password reset, and habit milestones.' },
    { title: 'Add export to CSV feature',        status: TaskStatus.TODO,        priority: 4, daysOffset: 10, description: 'Allow users to export transactions as CSV.' },
    { title: 'Performance audit',                status: TaskStatus.TODO,        priority: 3, daysOffset: 14, description: 'Profile slow queries and add missing indexes.' },
    { title: 'Write API documentation',          status: TaskStatus.TODO,        priority: 5, daysOffset: 12, description: 'Document all endpoints with request/response examples.' },
    { title: 'Deploy to staging environment',    status: TaskStatus.CANCELLED,   priority: 6, daysOffset:  2, description: 'Cancelled — waiting for infra team approval.' },
  ];

  for (const user of regularUsers) {
    for (const t of taskTemplates) {
      const existing = await taskRepo.findOne({ where: { userId: user.id, title: t.title } });
      if (existing) continue;

      await taskRepo.save(taskRepo.create({
        userId: user.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: daysFromNow(t.daysOffset),
      }));
    }
    console.log(`   ✔  ${taskTemplates.length} tasks → ${user.name}`);
  }

  // ── 3. Habits + logs ──────────────────────────────────────────────────────
  console.log('\n🔥 Seeding habits and logs...');

  const habitTemplates = [
    { name: 'Morning meditation',  description: '10 minutes of mindfulness every morning.',  frequency: 'daily',  streakDays: 14 },
    { name: 'Read 20 pages',       description: 'Read at least 20 pages of a book daily.',   frequency: 'daily',  streakDays: 7  },
    { name: 'Exercise',            description: '30 minutes of physical activity.',           frequency: 'daily',  streakDays: 21 },
    { name: 'Weekly review',       description: 'Review goals and plan the upcoming week.',   frequency: 'weekly', streakDays: 4  },
    { name: 'Drink 2L of water',   description: 'Stay hydrated throughout the day.',          frequency: 'daily',  streakDays: 30 },
    { name: 'No social media',     description: 'Avoid social media before 10am.',            frequency: 'daily',  streakDays: 5  },
  ];

  for (const user of regularUsers) {
    for (const h of habitTemplates) {
      const existing = await habitRepo.findOne({ where: { userId: user.id, name: h.name } });
      if (existing) continue;

      const lastCompleted = dateOnly(daysAgo(1));
      const habit = await habitRepo.save(habitRepo.create({
        userId: user.id,
        name: h.name,
        description: h.description,
        frequency: h.frequency,
        currentStreak: h.streakDays,
        longestStreak: h.streakDays + Math.floor(Math.random() * 10),
        lastCompletedDate: lastCompleted,
      }));

      // Seed completion logs for the streak period
      const logDays = h.frequency === 'daily' ? h.streakDays : h.streakDays;
      const step    = h.frequency === 'daily' ? 1 : 7;
      for (let i = logDays; i >= 1; i -= step) {
        const completedAt = dateOnly(daysAgo(i));
        const logExists = await habitLogRepo.findOne({ where: { habitId: habit.id, completedAt } });
        if (!logExists) {
          await habitLogRepo.save(habitLogRepo.create({ habitId: habit.id, completedAt }));
        }
      }
    }
    console.log(`   ✔  ${habitTemplates.length} habits + logs → ${user.name}`);
  }

  // ── 4. Accounts ───────────────────────────────────────────────────────────
  console.log('\n🏦 Seeding accounts...');

  const accountTemplates = [
    { name: 'Main Checking',  balance: 4250.00, currency: 'USD' },
    { name: 'Savings',        balance: 12800.00, currency: 'USD' },
    { name: 'Mobile Money',   balance: 850.00,  currency: 'RWF' },
  ];

  const userAccounts: Record<number, Account[]> = {};

  for (const user of regularUsers) {
    userAccounts[user.id] = [];
    for (const a of accountTemplates) {
      const existing = await accountRepo.findOne({ where: { userId: user.id, name: a.name } });
      if (existing) {
        userAccounts[user.id].push(existing);
        continue;
      }
      const acc = await accountRepo.save(accountRepo.create({ ...a, userId: user.id }));
      userAccounts[user.id].push(acc);
    }
    console.log(`   ✔  ${accountTemplates.length} accounts → ${user.name}`);
  }

  // ── 5. Transactions ───────────────────────────────────────────────────────
  console.log('\n💳 Seeding transactions...');

  const txTemplates: Array<{
    amount: number; description: string; category: string;
    transactionType: TransactionType; daysAgoOffset: number;
  }> = [
    // Income
    { amount: 3500.00, description: 'Monthly salary',          category: 'salary',        transactionType: TransactionType.INCOME,  daysAgoOffset: 30 },
    { amount: 3500.00, description: 'Monthly salary',          category: 'salary',        transactionType: TransactionType.INCOME,  daysAgoOffset: 0  },
    { amount: 250.00,  description: 'Freelance project',       category: 'freelance',     transactionType: TransactionType.INCOME,  daysAgoOffset: 15 },
    { amount: 120.00,  description: 'Dividend payment',        category: 'investment',    transactionType: TransactionType.INCOME,  daysAgoOffset: 10 },
    // Expenses
    { amount: 850.00,  description: 'Monthly rent',            category: 'housing',       transactionType: TransactionType.EXPENSE, daysAgoOffset: 28 },
    { amount: 120.00,  description: 'Electricity bill',        category: 'utilities',     transactionType: TransactionType.EXPENSE, daysAgoOffset: 25 },
    { amount: 45.00,   description: 'Internet subscription',   category: 'utilities',     transactionType: TransactionType.EXPENSE, daysAgoOffset: 25 },
    { amount: 280.00,  description: 'Grocery shopping',        category: 'food',          transactionType: TransactionType.EXPENSE, daysAgoOffset: 22 },
    { amount: 65.00,   description: 'Restaurant dinner',       category: 'food',          transactionType: TransactionType.EXPENSE, daysAgoOffset: 20 },
    { amount: 35.00,   description: 'Coffee & snacks',         category: 'food',          transactionType: TransactionType.EXPENSE, daysAgoOffset: 18 },
    { amount: 180.00,  description: 'Gym membership',          category: 'health',        transactionType: TransactionType.EXPENSE, daysAgoOffset: 30 },
    { amount: 55.00,   description: 'Pharmacy',                category: 'health',        transactionType: TransactionType.EXPENSE, daysAgoOffset: 12 },
    { amount: 95.00,   description: 'Uber rides',              category: 'transport',     transactionType: TransactionType.EXPENSE, daysAgoOffset: 16 },
    { amount: 40.00,   description: 'Fuel',                    category: 'transport',     transactionType: TransactionType.EXPENSE, daysAgoOffset: 8  },
    { amount: 15.99,   description: 'Netflix subscription',    category: 'entertainment', transactionType: TransactionType.EXPENSE, daysAgoOffset: 30 },
    { amount: 12.99,   description: 'Spotify subscription',    category: 'entertainment', transactionType: TransactionType.EXPENSE, daysAgoOffset: 30 },
    { amount: 200.00,  description: 'Online course',           category: 'education',     transactionType: TransactionType.EXPENSE, daysAgoOffset: 14 },
    { amount: 75.00,   description: 'Books',                   category: 'education',     transactionType: TransactionType.EXPENSE, daysAgoOffset: 9  },
    { amount: 320.00,  description: 'Clothing',                category: 'shopping',      transactionType: TransactionType.EXPENSE, daysAgoOffset: 21 },
    { amount: 500.00,  description: 'Emergency fund transfer', category: 'savings',       transactionType: TransactionType.EXPENSE, daysAgoOffset: 1  },
  ];

  for (const user of regularUsers) {
    const accounts = userAccounts[user.id];
    let count = 0;
    for (const t of txTemplates) {
      const existing = await txRepo.findOne({
        where: { userId: user.id, description: t.description, transactionType: t.transactionType },
      });
      if (existing) continue;

      await txRepo.save(txRepo.create({
        userId: user.id,
        accountId: accounts[0]?.id,
        amount: t.amount,
        description: t.description,
        category: t.category,
        transactionType: t.transactionType,
        date: daysAgo(t.daysAgoOffset),
      }));
      count++;
    }
    console.log(`   ✔  ${count} transactions → ${user.name}`);
  }

  // ── 6. Budgets ────────────────────────────────────────────────────────────
  console.log('\n📊 Seeding budgets...');

  const budgetTemplates = [
    { category: 'food',          limitAmount: 500.00,  period: 'monthly' },
    { category: 'housing',       limitAmount: 1000.00, period: 'monthly' },
    { category: 'transport',     limitAmount: 200.00,  period: 'monthly' },
    { category: 'entertainment', limitAmount: 100.00,  period: 'monthly' },
    { category: 'health',        limitAmount: 300.00,  period: 'monthly' },
    { category: 'education',     limitAmount: 400.00,  period: 'monthly' },
    { category: 'shopping',      limitAmount: 350.00,  period: 'monthly' },
    { category: 'utilities',     limitAmount: 200.00,  period: 'monthly' },
  ];

  // Matching spent amounts from transactions above
  const spentMap: Record<string, number> = {
    food: 380.00, housing: 850.00, transport: 135.00,
    entertainment: 28.98, health: 235.00, education: 275.00,
    shopping: 320.00, utilities: 165.00,
  };

  for (const user of regularUsers) {
    for (const b of budgetTemplates) {
      const existing = await budgetRepo.findOne({ where: { userId: user.id, category: b.category } });
      if (existing) continue;

      await budgetRepo.save(budgetRepo.create({
        ...b,
        userId: user.id,
        spent: spentMap[b.category] ?? 0,
      }));
    }
    console.log(`   ✔  ${budgetTemplates.length} budgets → ${user.name}`);
  }

  // ── 7. Groups ─────────────────────────────────────────────────────────────
  console.log('\n👥 Seeding groups...');

  const alice = regularUsers[0];
  const bob   = regularUsers[1];
  const carol = regularUsers[2];

  // Group 1: Alice creates "Apartment Expenses" with Bob and Carol
  const g1Exists = await groupRepo.findOne({ where: { name: 'Apartment Expenses', createdBy: alice.id } });
  if (!g1Exists) {
    const g1 = await groupRepo.save(groupRepo.create({ name: 'Apartment Expenses', createdBy: alice.id }));

    await memberRepo.save(memberRepo.create({ userId: alice.id, email: alice.email, groupId: g1.id }));
    await memberRepo.save(memberRepo.create({ userId: bob.id,   email: bob.email,   groupId: g1.id }));
    await memberRepo.save(memberRepo.create({ userId: carol.id, email: carol.email, groupId: g1.id }));

    // Group transactions
    await txRepo.save([
      txRepo.create({ userId: alice.id, groupId: g1.id, amount: 900.00, description: 'Monthly rent split', category: 'housing', transactionType: TransactionType.EXPENSE, date: daysAgo(28) }),
      txRepo.create({ userId: bob.id,   groupId: g1.id, amount: 120.00, description: 'Electricity bill',   category: 'utilities', transactionType: TransactionType.EXPENSE, date: daysAgo(25) }),
      txRepo.create({ userId: carol.id, groupId: g1.id, amount: 60.00,  description: 'Internet bill',      category: 'utilities', transactionType: TransactionType.EXPENSE, date: daysAgo(25) }),
    ]);

    console.log(`   ✔  Group "Apartment Expenses" (Alice + Bob + Carol)`);
  } else {
    console.log(`   ↩  Skipped group "Apartment Expenses" (already exists)`);
  }

  // Group 2: Bob creates "Road Trip" with Alice
  const g2Exists = await groupRepo.findOne({ where: { name: 'Road Trip', createdBy: bob.id } });
  if (!g2Exists) {
    const g2 = await groupRepo.save(groupRepo.create({ name: 'Road Trip', createdBy: bob.id }));

    await memberRepo.save(memberRepo.create({ userId: bob.id,   email: bob.email,   groupId: g2.id }));
    await memberRepo.save(memberRepo.create({ userId: alice.id, email: alice.email, groupId: g2.id }));

    await txRepo.save([
      txRepo.create({ userId: bob.id,   groupId: g2.id, amount: 150.00, description: 'Fuel for road trip', category: 'transport', transactionType: TransactionType.EXPENSE, date: daysAgo(10) }),
      txRepo.create({ userId: alice.id, groupId: g2.id, amount: 200.00, description: 'Hotel stay',         category: 'housing',   transactionType: TransactionType.EXPENSE, date: daysAgo(9)  }),
      txRepo.create({ userId: bob.id,   groupId: g2.id, amount: 180.00, description: 'Meals & dining',     category: 'food',      transactionType: TransactionType.EXPENSE, date: daysAgo(9)  }),
    ]);

    console.log(`   ✔  Group "Road Trip" (Bob + Alice)`);
  } else {
    console.log(`   ↩  Skipped group "Road Trip" (already exists)`);
  }

  // ── 8. Notifications ──────────────────────────────────────────────────────
  console.log('\n🔔 Seeding notifications...');

  for (const user of regularUsers) {
    const notifCount = await notifRepo.count({ where: { userId: user.id } });
    if (notifCount > 0) {
      console.log(`   ↩  Skipped notifications for ${user.name} (already exist)`);
      continue;
    }

    await notifRepo.save([
      notifRepo.create({
        userId: user.id,
        title: '👋 Welcome to Klenzo!',
        message: 'Your account is set up. Start by adding your first habit or task.',
        type: NotificationType.SUCCESS,
        category: NotificationCategory.NOTIFICATION,
        isRead: true,
        priority: 'high',
      }),
      notifRepo.create({
        userId: user.id,
        title: '🔥 7-day streak!',
        message: `You've completed "Morning meditation" for 7 days in a row. Keep it up!`,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.NOTIFICATION,
        isRead: false,
        priority: 'normal',
      }),
      notifRepo.create({
        userId: user.id,
        title: '⚠️ Budget Alert',
        message: 'You have exceeded your housing budget of $1,000 this month.',
        type: NotificationType.WARNING,
        category: NotificationCategory.NOTIFICATION,
        isRead: false,
        priority: 'high',
      }),
      notifRepo.create({
        userId: user.id,
        title: '📋 Task due tomorrow',
        message: '"Build finance dashboard UI" is due tomorrow. Don\'t forget!',
        type: NotificationType.INFO,
        category: NotificationCategory.NOTIFICATION,
        isRead: false,
        priority: 'normal',
      }),
    ]);
    console.log(`   ✔  4 notifications → ${user.name}`);
  }

  // ── 9. Global banner ──────────────────────────────────────────────────────
  console.log('\n📢 Seeding global banner...');

  const bannerExists = await notifRepo.findOne({
    where: { category: NotificationCategory.BANNER, isGlobal: true },
  });

  if (!bannerExists) {
    await notifRepo.save(notifRepo.create({
      userId: null as any,
      title: 'Welcome to Klenzo Beta!',
      message: "🚀 We're in beta — your feedback helps us improve. Report issues via the Help menu.",
      type: NotificationType.INFO,
      category: NotificationCategory.BANNER,
      isGlobal: true,
      color: '#6366f1',
      dismissible: true,
      priority: 'normal',
    }));
    console.log('   ✔  Global welcome banner created');
  } else {
    console.log('   ↩  Skipped banner (already exists)');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────');
  console.log('✅ Seed complete!\n');
  console.log('Credentials:');
  console.log('  superadmin@klenzo.com  /  SuperAdmin@123  (superadmin)');
  console.log('  admin@klenzo.com       /  Admin@1234      (admin)');
  console.log('  alice@example.com      /  Alice@1234      (user)');
  console.log('  bob@example.com        /  Bob@12345       (user)');
  console.log('  carol@example.com      /  Carol@1234      (user)');
  console.log('─────────────────────────────────────────\n');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
