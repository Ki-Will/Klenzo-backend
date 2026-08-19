import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus, TransactionType } from '@prisma/client';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class InsightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Dashboard ────────────────────────────────────────────────────────────
  // Cached in Redis for 2 min. Invalidated automatically by TTL expiry.
  // (Insights are aggregate reads — we accept up to 2 min staleness.)

  async getDashboard(userId: string) {
    const key = RedisService.keys.insights(userId);
    const cached = await this.redis.get<ReturnType<typeof this._buildDashboard>>(key);
    if (cached) return cached;

    const result = await this._buildDashboard(userId);
    await this.redis.set(key, result, RedisService.TTL.INSIGHTS);
    return result;
  }

  private async _buildDashboard(userId: string) {
    const [tasks, habits, transactions] = await Promise.all([
      this.prisma.task.findMany({ where: { userId } }),
      this.prisma.habit.findMany({ where: { userId } }),
      this.prisma.transaction.findMany({ where: { userId } }),
    ]);

    const done = tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const inProg = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
    const todo = tasks.filter((t) => t.status === TaskStatus.TODO).length;
    const cancelled = tasks.filter((t) => t.status === TaskStatus.CANCELLED).length;

    const taskStats = {
      total: tasks.length,
      todo,
      inProgress: inProg,
      done,
      cancelled,
      completionRate: tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0,
    };

    const habitStats = {
      total: habits.length,
      activeStreaks: habits.filter((h) => h.currentStreak > 0).length,
      longestCurrentStreak: habits.reduce((m, h) => Math.max(m, h.currentStreak), 0),
      longestEverStreak: habits.reduce((m, h) => Math.max(m, h.longestStreak), 0),
    };

    const expenses = transactions.filter((t) => t.transactionType === TransactionType.EXPENSE);
    const income = transactions.filter((t) => t.transactionType === TransactionType.INCOME);
    const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount), 0);
    const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0);

    const financeStats = {
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      netBalance: Math.round((totalIncome - totalExpenses) * 100) / 100,
      transactionCount: transactions.length,
    };

    return {
      tasks: taskStats,
      habits: habitStats,
      finance: financeStats,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Productivity trends ──────────────────────────────────────────────────

  async getProductivityTrends(userId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [tasks, habitLogs] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          userId,
          updatedAt: { gte: since },
        },
      }),
      this.prisma.habitLog.findMany({
        where: {
          habit: { userId },
          createdAt: { gte: since },
        },
      }),
    ]);

    const completedByDay: Record<string, number> = {};
    for (const task of tasks) {
      if (task.status === TaskStatus.DONE) {
        const day = task.updatedAt.toISOString().split('T')[0];
        completedByDay[day] = (completedByDay[day] || 0) + 1;
      }
    }

    const habitsByDay: Record<string, number> = {};
    for (const log of habitLogs) {
      const day = new Date(log.completedAt).toISOString().split('T')[0];
      habitsByDay[day] = (habitsByDay[day] || 0) + 1;
    }

    return { period: `${days} days`, tasksCompleted: completedByDay, habitsCompleted: habitsByDay };
  }

  // ─── Spending trends ──────────────────────────────────────────────────────

  async getSpendingTrends(userId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: since },
      },
      orderBy: { date: 'asc' },
    });

    const byDay: Record<string, { income: number; expense: number }> = {};
    for (const tx of transactions) {
      const day = new Date(tx.date).toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = { income: 0, expense: 0 };
      if (tx.transactionType === TransactionType.INCOME) byDay[day].income += Number(tx.amount);
      else byDay[day].expense += Number(tx.amount);
    }

    return { period: `${days} days`, byDay };
  }

  // ─── Cache invalidation (called by other services after writes) ───────────

  async invalidateDashboard(userId: string) {
    await this.redis.del(RedisService.keys.insights(userId));
  }
}
