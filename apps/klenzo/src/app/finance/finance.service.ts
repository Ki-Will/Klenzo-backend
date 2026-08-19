import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus, TransactionType, NotificationType, NotificationCategory, BudgetPeriod } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { InsightService } from '../insight/insight.service';
import {
  CreateTransactionDto,
  CreateGroupDto,
  CreateBudgetDto,
  UpdateBudgetDto,
  UpdateTransactionDto,
  AnalyticsQueryDto,
} from '../dto/finance.dto';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly insightService: InsightService,
  ) { }

  // ─── Transactions ─────────────────────────────────────────────────────────

  async createTransaction(userId: string, dto: CreateTransactionDto) {
    const saved = await this.prisma.transaction.create({
      data: {
        userId,
        amount: dto.amount,
        description: dto.description ?? null,
        category: dto.category ?? null,
        transactionType: dto.transactionType as TransactionType,
        date: new Date(dto.date),
        groupId: dto.groupId ?? null,
        accountId: dto.accountId ?? null,
        status: (dto.status as TransactionStatus) ?? TransactionStatus.APPROVED,
        parentTransactionId: dto.parentTransactionId ?? null,
      },
    });

    // Update budget
    if (saved.status === TransactionStatus.APPROVED && dto.transactionType === 'EXPENSE') {
      let budget = null;
      if (dto.budgetId) {
        budget = await this.prisma.budget.findFirst({ where: { id: dto.budgetId, userId } });
      } else if (dto.category) {
        budget = await this.prisma.budget.findFirst({ where: { userId, category: dto.category } });
      }

      if (budget) {
        const newSpent = Number(budget.spent) + Number(dto.amount);
        await this.prisma.budget.update({
          where: { id: budget.id },
          data: { spent: newSpent },
        });

        if (newSpent > Number(budget.limitAmount)) {
          this.notificationService.createNotification({
            userId,
            title: '⚠️ Budget Exceeded',
            message: `You exceeded your "${budget.name}" budget of ${budget.limitAmount}. Spent: ${newSpent}.`,
            type: NotificationType.WARNING,
            category: NotificationCategory.TRANSACTION,
          }).catch(() => null);
        }
      }
    }

    this.insightService.invalidateDashboard(userId).catch(() => null);
    return saved;
  }

  async getTransactions(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId, status: TransactionStatus.APPROVED },
      orderBy: { date: 'desc' },
    });
  }

  async getTransaction(userId: string, transactionId: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.userId !== userId) throw new ForbiddenException();
    return tx;
  }

  async deleteTransaction(userId: string, transactionId: string): Promise<{ message: string }> {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.userId !== userId) throw new ForbiddenException();

    // If it was linked to a budget, decrease spent
    if (tx.budgetId && tx.status === TransactionStatus.APPROVED && tx.transactionType === TransactionType.EXPENSE) {
      const budget = await this.prisma.budget.findUnique({ where: { id: tx.budgetId } });
      if (budget) {
        const newSpent = Math.max(0, Number(budget.spent) - Number(tx.amount));
        await this.prisma.budget.update({
          where: { id: budget.id },
          data: { spent: newSpent },
        });
      }
    }

    await this.prisma.transaction.delete({ where: { id: transactionId } });
    this.insightService.invalidateDashboard(userId).catch(() => null);
    return { message: 'Transaction deleted' };
  }

  async updateTransaction(userId: string, transactionId: string, dto: UpdateTransactionDto) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.userId !== userId) throw new ForbiddenException();

    const oldAmount = Number(tx.amount);
    const oldBudgetId = tx.budgetId;
    const wasApprovedExpense = tx.status === TransactionStatus.APPROVED && tx.transactionType === TransactionType.EXPENSE;

    // Update transaction
    const saved = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        amount: dto.amount ?? tx.amount,
        description: dto.description ?? tx.description,
        category: dto.category ?? tx.category,
        transactionType: dto.transactionType ? (dto.transactionType as TransactionType) : tx.transactionType,
        date: dto.date ? new Date(dto.date) : tx.date,
        groupId: dto.groupId ?? tx.groupId,
        accountId: dto.accountId ?? tx.accountId,
        status: dto.status ? (dto.status as TransactionStatus) : tx.status,
        parentTransactionId: dto.parentTransactionId ?? tx.parentTransactionId,
        budgetId: dto.budgetId ?? tx.budgetId,
      },
    });

    const isApprovedExpense = saved.status === TransactionStatus.APPROVED && saved.transactionType === TransactionType.EXPENSE;

    // Re-calculate budgets
    if (wasApprovedExpense || isApprovedExpense) {
      // 1. Remove from old budget if changed
      if (wasApprovedExpense && oldBudgetId) {
        const oldBudget = await this.prisma.budget.findUnique({ where: { id: oldBudgetId } });
        if (oldBudget) {
          const newSpent = Math.max(0, Number(oldBudget.spent) - oldAmount);
          await this.prisma.budget.update({
            where: { id: oldBudget.id },
            data: { spent: newSpent },
          });
        }
      }

      // 2. Add to new budget
      if (isApprovedExpense && saved.budgetId) {
        const newBudget = await this.prisma.budget.findUnique({ where: { id: saved.budgetId } });
        if (newBudget) {
          const newSpent = Number(newBudget.spent) + Number(saved.amount);
          await this.prisma.budget.update({
            where: { id: newBudget.id },
            data: { spent: newSpent },
          });
        }
      }
    }

    this.insightService.invalidateDashboard(userId).catch(() => null);
    return saved;
  }

  async approveTransaction(userId: string, transactionId: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.userId !== userId) {
      throw new ForbiddenException('You can only approve your own transactions');
    }
    if (tx.status === TransactionStatus.APPROVED) {
      throw new BadRequestException('Transaction is already approved');
    }

    const saved = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.APPROVED },
    });

    if (tx.transactionType === TransactionType.EXPENSE) {
      let budget = null;
      if (tx.budgetId) {
        budget = await this.prisma.budget.findFirst({ where: { id: tx.budgetId, userId } });
      } else if (tx.category) {
        budget = await this.prisma.budget.findFirst({ where: { userId, category: tx.category } });
      }
      if (budget) {
        const newSpent = Number(budget.spent) + Number(tx.amount);
        await this.prisma.budget.update({
          where: { id: budget.id },
          data: { spent: newSpent },
        });
      }
    }

    this.insightService.invalidateDashboard(userId).catch(() => null);
    return saved;
  }

  // ─── Groups ───────────────────────────────────────────────────────────────

  async createGroup(userId: string, dto: CreateGroupDto) {
    const creator = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!creator) throw new NotFoundException('User not found');

    const savedGroup = await this.prisma.group.create({
      data: { name: dto.name, createdBy: userId },
    });

    const emails = new Set<string>([creator.email.toLowerCase()]);
    for (const email of dto.memberEmails ?? []) {
      emails.add(email.trim().toLowerCase());
    }

    const members = await Promise.all(
      [...emails].map(async (email) => {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) {
          throw new NotFoundException(
            `User "${email}" not found. They must register first, or add them later.`,
          );
        }
        return this.prisma.groupMember.create({
          data: {
            email: user.email,
            userId: user.id,
            groupId: savedGroup.id,
          },
        });
      }),
    );

    this.notificationService.createNotification({
      userId,
      title: '👥 Group Created',
      message: `You created the group "${savedGroup.name}".`,
      type: NotificationType.INFO,
      category: NotificationCategory.GROUP,
    }).catch(() => null);

    // Notify other members
    for (const member of members) {
      if (member.userId !== userId) {
        this.notificationService.createNotification({
          userId: member.userId,
          title: '👥 Group Invitation',
          message: `You have been added to the group "${savedGroup.name}" by ${creator.name || creator.email}.`,
          type: NotificationType.INFO,
          category: NotificationCategory.GROUP,
        }).catch(() => null);
      }
    }

    return this.prisma.group.findUnique({
      where: { id: savedGroup.id },
      include: { members: true },
    });
  }

  async getGroups(userId: string) {
    // Get groups where user is creator or member
    const groups = await this.prisma.group.findMany({
      where: {
        OR: [
          { createdBy: userId },
          { members: { some: { userId } } },
        ],
      },
      include: { members: true, transactions: true },
    });

    return groups.map((group) => {
      const memberCount = group.members.length;
      let netBalance = 0;
      if (memberCount > 0) {
        for (const tx of group.transactions) {
          if (tx.transactionType === TransactionType.EXPENSE && tx.status === TransactionStatus.APPROVED) {
            const share = Number(tx.amount) / memberCount;
            netBalance += tx.userId === userId ? Number(tx.amount) - share : -share;
          }
        }
      }
      return { ...group, memberCount, netBalance: Math.round(netBalance * 100) / 100 };
    });
  }

  async updateGroup(userId: string, groupId: string, name: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException('Group not found');
    if (group.createdBy !== userId) throw new ForbiddenException();

    const saved = await this.prisma.group.update({
      where: { id: groupId },
      data: { name },
    });

    for (const member of group.members) {
      if (member.userId) {
        this.notificationService.createNotification({
          userId: member.userId,
          title: '👥 Group Updated',
          message: `The group "${group.name}" has been renamed.`,
          type: NotificationType.INFO,
          category: NotificationCategory.GROUP,
        }).catch(() => null);
      }
    }
    return saved;
  }

  async getGroupDetail(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true, transactions: true },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, userId);
    return group;
  }

  async getGroupTransactions(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, userId);

    return this.prisma.transaction.findMany({
      where: { groupId },
      orderBy: { date: 'desc' },
    });
  }

  async addGroupMember(userId: string, groupId: string, email: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, userId);

    const userToAdd = await this.prisma.user.findUnique({ where: { email } });
    if (!userToAdd) {
      throw new NotFoundException(`User "${email}" not found.`);
    }
    if (group.members.find((m) => m.userId === userToAdd.id)) {
      throw new BadRequestException(`"${email}" is already in this group.`);
    }

    await this.prisma.groupMember.create({
      data: { email, userId: userToAdd.id, groupId },
    });

    this.notificationService.createNotification({
      userId: userToAdd.id,
      title: '👥 Added to Group',
      message: `You have been added to the group "${group.name}".`,
      type: NotificationType.INFO,
      category: NotificationCategory.GROUP,
    }).catch(() => null);

    return this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
  }

  async removeGroupMember(userId: string, groupId: string, memberId: string): Promise<{ message: string }> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.createdBy !== userId) throw new ForbiddenException();

    const member = await this.prisma.groupMember.findFirst({
      where: { id: memberId, groupId },
    });
    if (!member) throw new NotFoundException('Member not found');

    await this.prisma.groupMember.delete({ where: { id: memberId } });
    this.notificationService.createNotification({
      userId: member.userId,
      title: '👥 Removed from Group',
      message: `You have been removed from the group "${group.name}".`,
      type: NotificationType.WARNING,
      category: NotificationCategory.GROUP,
    }).catch(() => null);

    return { message: 'Member removed' };
  }

  async deleteGroup(userId: string, groupId: string): Promise<{ message: string }> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.createdBy !== userId) throw new ForbiddenException();
    await this.prisma.group.delete({ where: { id: groupId } });
    return { message: 'Group deleted' };
  }

  async getGroupBalances(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true, transactions: true },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, userId);

    if (group.members.length === 0) return [];
    const net: Record<string, { userId: string; name: string; balance: number }> = {};

    for (const m of group.members) {
      const user = await this.prisma.user.findUnique({ where: { id: m.userId } });
      net[m.userId] = { userId: m.userId, name: user?.name ?? m.email, balance: 0 };
    }

    for (const tx of group.transactions) {
      if (tx.transactionType !== TransactionType.EXPENSE) continue;
      if (tx.status !== TransactionStatus.APPROVED) continue;

      const share = Number(tx.amount) / group.members.length;
      if (net[tx.userId]) net[tx.userId].balance += Number(tx.amount) - share;
      for (const m of group.members) {
        if (m.userId !== tx.userId && net[m.userId]) net[m.userId].balance -= share;
      }
    }

    return Object.values(net).map((entry) => ({
      userId: entry.userId,
      name: entry.name,
      balance: Math.round(entry.balance * 100) / 100,
      status: entry.balance > 0 ? 'owed' : entry.balance < 0 ? 'owes' : 'settled',
    }));
  }

  async settleGroup(userId: string, groupId: string, amount: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, userId);

    return this.prisma.transaction.create({
      data: {
        userId,
        groupId,
        amount,
        transactionType: TransactionType.INCOME,
        description: 'Group settlement',
        category: 'settlement',
        date: new Date(),
        status: TransactionStatus.APPROVED,
      },
    });
  }

  // ─── Budgets ──────────────────────────────────────────────────────────────

  async createBudget(userId: string, dto: CreateBudgetDto) {
    const period = (dto.period as BudgetPeriod) || BudgetPeriod.MONTHLY;
    const saved = await this.prisma.budget.create({
      data: {
        userId,
        name: dto.name,
        category: dto.category,
        limitAmount: dto.limitAmount,
        period,
        color: dto.color,
        icon: dto.icon,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });

    this.notificationService.createNotification({
      userId,
      title: '📊 Budget Created',
      message: `Budget "${saved.name}" set at ${saved.limitAmount} (${saved.period}).`,
      type: NotificationType.INFO,
      category: NotificationCategory.TRANSACTION,
    }).catch(() => null);
    return saved;
  }

  async getBudgets(userId: string) {
    return this.prisma.budget.findMany({ where: { userId } });
  }

  async updateBudget(userId: string, budgetId: string, dto: UpdateBudgetDto) {
    const budget = await this.prisma.budget.findFirst({ where: { id: budgetId, userId } });
    if (!budget) throw new NotFoundException('Budget not found');
    
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.limitAmount !== undefined) updateData.limitAmount = dto.limitAmount;
    if (dto.period !== undefined) updateData.period = dto.period as BudgetPeriod;
    if (dto.color !== undefined) updateData.color = dto.color;
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.startDate !== undefined) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) updateData.endDate = new Date(dto.endDate);

    const saved = await this.prisma.budget.update({
      where: { id: budgetId },
      data: updateData,
    });
    await this.recalculateBudgetSpent(userId, budgetId);
    return saved;
  }

  async deleteBudget(userId: string, budgetId: string): Promise<{ message: string }> {
    const budget = await this.prisma.budget.findFirst({ where: { id: budgetId, userId } });
    if (!budget) throw new NotFoundException('Budget not found');

    // Unlink transactions
    await this.prisma.transaction.updateMany({
      where: { budgetId },
      data: { budgetId: null },
    });

    await this.prisma.budget.delete({ where: { id: budgetId } });
    return { message: 'Budget deleted' };
  }

  async recalculateBudgetSpent(userId: string, budgetId: string): Promise<void> {
    const budget = await this.prisma.budget.findFirst({ where: { id: budgetId, userId } });
    if (!budget) return;

    // Sum transactions explicitly linked to this budget
    const linkedTx = await this.prisma.transaction.findMany({
      where: {
        budgetId,
        userId,
        status: TransactionStatus.APPROVED,
        transactionType: TransactionType.EXPENSE,
      },
    });
    let total = linkedTx.reduce((s, t) => s + Number(t.amount), 0);

    // If budget has a category, also include transactions with that category that AREN'T linked to another budget
    if (budget.category) {
      const catTx = await this.prisma.transaction.findMany({
        where: {
          category: budget.category,
          userId,
          status: TransactionStatus.APPROVED,
          transactionType: TransactionType.EXPENSE,
          budgetId: null,
        },
      });
      total += catTx.reduce((s, t) => s + Number(t.amount), 0);
    }

    await this.prisma.budget.update({
      where: { id: budgetId },
      data: { spent: Math.round(total * 100) / 100 },
    });
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  async getSpendingSummary(userId: string) {
    const [expenses, income] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, transactionType: TransactionType.EXPENSE, status: TransactionStatus.APPROVED },
      }),
      this.prisma.transaction.findMany({
        where: { userId, transactionType: TransactionType.INCOME, status: TransactionStatus.APPROVED },
      }),
    ]);

    const totalExpenses = expenses.reduce((a, t) => a + Number(t.amount), 0);
    const totalIncome = income.reduce((a, t) => a + Number(t.amount), 0);

    const byCategory = expenses.reduce((acc, t) => {
      const cat = t.category || 'other';
      acc[cat] = (acc[cat] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

    const now = new Date();
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thisMonth = expenses
      .filter((t) => new Date(t.date) >= startThisMonth)
      .reduce((a, t) => a + Number(t.amount), 0);
    const lastMonth = expenses
      .filter((t) => new Date(t.date) >= startLastMonth && new Date(t.date) < startThisMonth)
      .reduce((a, t) => a + Number(t.amount), 0);

    const change = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 1000) / 10 : 0;

    return {
      totalSpend: Math.round(totalExpenses * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      netBalance: Math.round((totalIncome - totalExpenses) * 100) / 100,
      change,
      byCategory,
    };
  }

  async getSpendingByCategories(userId: string, query: AnalyticsQueryDto) {
    const where: any = {
      userId,
      transactionType: TransactionType.EXPENSE,
      status: TransactionStatus.APPROVED,
    };
    if (query.from && query.to) {
      where.date = { gte: new Date(query.from), lte: new Date(query.to) };
    } else if (query.from) {
      where.date = { gte: new Date(query.from) };
    } else if (query.to) {
      where.date = { lte: new Date(query.to) };
    }

    const transactions = await this.prisma.transaction.findMany({ where });
    const total = transactions.reduce((s, t) => s + Number(t.amount), 0);

    const map: Record<string, { amount: number; count: number }> = {};
    for (const tx of transactions) {
      const cat = tx.category || 'Other';
      if (!map[cat]) map[cat] = { amount: 0, count: 0 };
      map[cat].amount += Number(tx.amount);
      map[cat].count += 1;
    }

    return Object.entries(map)
      .map(([category, d]) => ({
        category,
        amount: Math.round(d.amount * 100) / 100,
        percentage: total > 0 ? Math.round((d.amount / total) * 1000) / 10 : 0,
        count: d.count,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  async getAccounts(userId: string) {
    return this.prisma.account.findMany({ where: { userId } });
  }

  private assertGroupAccess(group: { createdBy: string; members: { userId: string }[] }, userId: string): void {
    const isCreator = group.createdBy === userId;
    const isMember = group.members?.some((member) => member.userId === userId);
    if (!isCreator && !isMember) throw new ForbiddenException();
  }
}
