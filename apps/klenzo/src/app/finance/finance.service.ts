import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, IsNull } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { Transaction, TransactionStatus, TransactionType } from '../entities/transaction.entity';
import { Group, GroupMember } from '../entities/group.entity';
import { Budget } from '../entities/budget.entity';
import { Account } from '../entities/account.entity';
import { User } from '../entities/user.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType, NotificationCategory } from '../entities/notification.entity';
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
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepo: Repository<GroupMember>,
    @InjectRepository(Budget)
    private readonly budgetRepo: Repository<Budget>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationService: NotificationService,
    private readonly insightService: InsightService,
    private readonly redis: RedisService,
  ) { }

  // ─── Transactions ─────────────────────────────────────────────────────────

  async createTransaction(userId: number, dto: CreateTransactionDto): Promise<Transaction> {
    const transaction = this.transactionRepo.create({
      userId,
      amount: dto.amount,
      description: dto.description ?? null,
      category: dto.category ?? null,
      transactionType: dto.transactionType,
      date: new Date(dto.date),
      groupId: dto.groupId ?? null,
      accountId: dto.accountId ?? null,
      status: (dto.status as TransactionStatus) ?? TransactionStatus.APPROVED,
      parentTransactionId: dto.parentTransactionId ?? null,
    });
    const saved = await this.transactionRepo.save(transaction);

    // Update budget
    if (saved.status === TransactionStatus.APPROVED && dto.transactionType === TransactionType.EXPENSE) {
      let budget: Budget | null = null;
      if (dto.budgetId) {
        budget = await this.budgetRepo.findOne({ where: { id: dto.budgetId, userId } });
      } else if (dto.category) {
        budget = await this.budgetRepo.findOne({ where: { userId, category: dto.category } });
      }

      if (budget) {
        budget.spent = Number(budget.spent) + Number(dto.amount);
        await this.budgetRepo.save(budget);

        if (Number(budget.spent) > Number(budget.limitAmount)) {
          this.notificationService.createNotification({
            userId,
            title: '⚠️ Budget Exceeded',
            message: `You exceeded your "${budget.name}" budget of ${budget.limitAmount}. Spent: ${budget.spent}.`,
            type: NotificationType.WARNING,
            category: NotificationCategory.TRANSACTION,
          }).catch(() => null);
        }
      }
    }

    this.insightService.invalidateDashboard(userId).catch(() => null);
    await this.redis.del(RedisService.keys.transactions(userId));
    return saved;
  }

  async getTransactions(userId: number): Promise<Transaction[]> {
    const cacheKey = RedisService.keys.transactions(userId);
    const cached = await this.redis.get<Transaction[]>(cacheKey);
    if (cached) return cached;

    const transactions = await this.transactionRepo.find({
      where: { userId, status: TransactionStatus.APPROVED },
      order: { date: 'DESC' },
    });
    await this.redis.set(cacheKey, transactions, 60); // Cache for 1 min
    return transactions;
  }

  async getTransaction(userId: number, transactionId: number): Promise<Transaction> {
    const tx = await this.transactionRepo.findOne({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.userId !== userId) throw new ForbiddenException();
    return tx;
  }

  async deleteTransaction(userId: number, transactionId: number): Promise<{ message: string }> {
    const tx = await this.transactionRepo.findOne({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.userId !== userId) throw new ForbiddenException();

    // If it was linked to a budget, decrease spent
    if (tx.budgetId && tx.status === TransactionStatus.APPROVED && tx.transactionType === TransactionType.EXPENSE) {
      const budget = await this.budgetRepo.findOne({ where: { id: tx.budgetId } });
      if (budget) {
        budget.spent = Math.max(0, Number(budget.spent) - Number(tx.amount));
        await this.budgetRepo.save(budget);
      }
    }

    await this.transactionRepo.delete(transactionId);
    this.insightService.invalidateDashboard(userId).catch(() => null);
    await this.redis.del(RedisService.keys.transactions(userId));
    return { message: 'Transaction deleted' };
  }

  async updateTransaction(userId: number, transactionId: number, dto: UpdateTransactionDto): Promise<Transaction> {
    const tx = await this.transactionRepo.findOne({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.userId !== userId) throw new ForbiddenException();

    const oldAmount = Number(tx.amount);
    const oldBudgetId = tx.budgetId;
    const wasApprovedExpense = tx.status === TransactionStatus.APPROVED && tx.transactionType === TransactionType.EXPENSE;

    // Update fields
    if (dto.amount !== undefined) tx.amount = dto.amount;
    if (dto.description !== undefined) tx.description = dto.description;
    if (dto.category !== undefined) tx.category = dto.category;
    if (dto.transactionType !== undefined) tx.transactionType = dto.transactionType;
    if (dto.date !== undefined) tx.date = new Date(dto.date);
    if (dto.groupId !== undefined) tx.groupId = dto.groupId;
    if (dto.accountId !== undefined) tx.accountId = dto.accountId;
    if (dto.status !== undefined) tx.status = dto.status as TransactionStatus;
    if (dto.parentTransactionId !== undefined) tx.parentTransactionId = dto.parentTransactionId;
    if (dto.budgetId !== undefined) tx.budgetId = dto.budgetId;

    const saved = await this.transactionRepo.save(tx);
    const isApprovedExpense = saved.status === TransactionStatus.APPROVED && saved.transactionType === TransactionType.EXPENSE;

    // Re-calculate budgets
    if (wasApprovedExpense || isApprovedExpense) {
      // 1. Remove from old budget if changed
      if (wasApprovedExpense && oldBudgetId) {
        const oldBudget = await this.budgetRepo.findOne({ where: { id: oldBudgetId } });
        if (oldBudget) {
          oldBudget.spent = Math.max(0, Number(oldBudget.spent) - oldAmount);
          await this.budgetRepo.save(oldBudget);
        }
      }

      // 2. Add to new budget
      if (isApprovedExpense && saved.budgetId) {
        const newBudget = await this.budgetRepo.findOne({ where: { id: saved.budgetId } });
        if (newBudget) {
          newBudget.spent = Number(newBudget.spent) + Number(saved.amount);
          await this.budgetRepo.save(newBudget);
        }
      }
    }

    this.insightService.invalidateDashboard(userId).catch(() => null);
    await this.redis.del(RedisService.keys.transactions(userId));
    return saved;
  }

  async approveTransaction(userId: number, transactionId: number): Promise<Transaction> {
    const tx = await this.transactionRepo.findOne({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.userId !== userId) {
      throw new ForbiddenException('You can only approve your own transactions');
    }
    if (tx.status === TransactionStatus.APPROVED) {
      throw new BadRequestException('Transaction is already approved');
    }

    tx.status = TransactionStatus.APPROVED;
    const saved = await this.transactionRepo.save(tx);

    if (tx.transactionType === TransactionType.EXPENSE) {
      let budget: Budget | null = null;
      if (tx.budgetId) {
        budget = await this.budgetRepo.findOne({ where: { id: tx.budgetId, userId } });
      } else if (tx.category) {
        budget = await this.budgetRepo.findOne({ where: { userId, category: tx.category } });
      }
      if (budget) {
        budget.spent = Number(budget.spent) + Number(tx.amount);
        await this.budgetRepo.save(budget);
      }
    }

    this.insightService.invalidateDashboard(userId).catch(() => null);
    await this.redis.del(RedisService.keys.transactions(userId));
    return saved;
  }

  // ─── Groups ───────────────────────────────────────────────────────────────

  async createGroup(userId: number, dto: CreateGroupDto): Promise<Group> {
    const creator = await this.userRepository.findOne({ where: { id: userId } });
    if (!creator) throw new NotFoundException('User not found');

    const savedGroup = await this.groupRepo.save(
      this.groupRepo.create({ name: dto.name, createdBy: userId }),
    );

    const emails = new Set<string>([creator.email.toLowerCase()]);
    for (const email of dto.memberEmails ?? []) {
      emails.add(email.trim().toLowerCase());
    }

    const members = await Promise.all(
      [...emails].map(async (email) => {
        const user = await this.userRepository.findOne({ where: { email } });
        if (!user) {
          throw new NotFoundException(
            `User "${email}" not found. They must register first, or add them later.`,
          );
        }
        return this.groupMemberRepo.create({
          email: user.email,
          userId: user.id,
          groupId: savedGroup.id,
        });
      }),
    );
    await this.groupMemberRepo.save(members);

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

    return this.groupRepo.findOne({
      where: { id: savedGroup.id },
      relations: ['members'],
    }) as Promise<Group>;
  }

  async getGroups(userId: number) {
    const groups = await this.groupRepo.find({
      where: [
        { createdBy: userId },
        { members: { userId } }
      ],
      relations: ['members', 'transactions'],
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

  async updateGroup(userId: number, groupId: string, name: string): Promise<Group> {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['members'],
    });
    if (!group) throw new NotFoundException('Group not found');
    if (group.createdBy !== userId) throw new ForbiddenException();

    group.name = name;
    const saved = await this.groupRepo.save(group);

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

  async getGroupDetail(userId: number, groupId: string): Promise<Group> {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['members', 'transactions'],
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, userId);
    return group;
  }

  async getGroupTransactions(userId: number, groupId: string): Promise<Transaction[]> {
    const group = await this.groupRepo.findOne({ where: { id: groupId }, relations: ['members'] });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, userId);

    return this.transactionRepo.find({
      where: { groupId },
      order: { date: 'DESC' },
    });
  }

  async addGroupMember(userId: number, groupId: string, email: string): Promise<Group> {
    const group = await this.groupRepo.findOne({ where: { id: groupId }, relations: ['members'] });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, userId);

    const userToAdd = await this.userRepository.findOne({ where: { email } });
    if (!userToAdd) {
      throw new NotFoundException(`User "${email}" not found.`);
    }
    if (group.members.find((m) => m.userId === userToAdd.id)) {
      throw new BadRequestException(`"${email}" is already in this group.`);
    }

    await this.groupMemberRepo.save(
      this.groupMemberRepo.create({ email, userId: userToAdd.id, groupId }),
    );

    this.notificationService.createNotification({
      userId: userToAdd.id,
      title: '👥 Added to Group',
      message: `You have been added to the group "${group.name}".`,
      type: NotificationType.INFO,
      category: NotificationCategory.GROUP,
    }).catch(() => null);

    return this.groupRepo.findOne({ where: { id: groupId }, relations: ['members'] }) as Promise<Group>;
  }

  async removeGroupMember(userId: number, groupId: string, memberId: number): Promise<{ message: string }> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.createdBy !== userId) throw new ForbiddenException();

    const member = await this.groupMemberRepo.findOne({ where: { id: memberId, groupId } });
    if (!member) throw new NotFoundException('Member not found');

    await this.groupMemberRepo.remove(member);
    this.notificationService.createNotification({
      userId: member.userId,
      title: '👥 Removed from Group',
      message: `You have been removed from the group "${group.name}".`,
      type: NotificationType.WARNING,
      category: NotificationCategory.GROUP,
    }).catch(() => null);

    return { message: 'Member removed' };
  }

  async deleteGroup(userId: number, groupId: string): Promise<{ message: string }> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.createdBy !== userId) throw new ForbiddenException();
    await this.groupRepo.remove(group);
    return { message: 'Group deleted' };
  }

  async getGroupBalances(userId: number, groupId: string) {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['members', 'transactions'],
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, userId);

    if (group.members.length === 0) return [];
    const net: Record<number, { userId: number; name: string; balance: number }> = {};

    for (const m of group.members) {
      const user = await this.userRepository.findOne({ where: { id: m.userId } });
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

  async settleGroup(userId: number, groupId: string, amount: number): Promise<Transaction> {
    const group = await this.groupRepo.findOne({ where: { id: groupId }, relations: ['members'] });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, userId);

    return this.transactionRepo.save(
      this.transactionRepo.create({
        userId,
        groupId,
        amount,
        transactionType: TransactionType.INCOME,
        description: 'Group settlement',
        category: 'settlement',
        date: new Date(),
        status: TransactionStatus.APPROVED,
      }),
    );
  }

  // ─── Budgets ──────────────────────────────────────────────────────────────

  async createBudget(userId: number, dto: CreateBudgetDto): Promise<Budget> {
    const budget = this.budgetRepo.create({ ...dto, userId });
    if (!budget.period) budget.period = 'monthly';
    const saved = await this.budgetRepo.save(budget);
    
    this.notificationService.createNotification({
      userId,
      title: '📊 Budget Created',
      message: `Budget "${saved.name}" set at ${saved.limitAmount} (${saved.period}).`,
      type: NotificationType.INFO,
      category: NotificationCategory.TRANSACTION,
    }).catch(() => null);
    return saved;
  }

  async getBudgets(userId: number): Promise<Budget[]> {
    return this.budgetRepo.find({ where: { userId } });
  }

  async updateBudget(userId: number, budgetId: number, dto: UpdateBudgetDto): Promise<Budget> {
    const budget = await this.budgetRepo.findOne({ where: { id: budgetId, userId } });
    if (!budget) throw new NotFoundException('Budget not found');
    Object.assign(budget, dto);
    const saved = await this.budgetRepo.save(budget);
    await this.recalculateBudgetSpent(userId, budgetId);
    return saved;
  }

  async deleteBudget(userId: number, budgetId: number): Promise<{ message: string }> {
    const budget = await this.budgetRepo.findOne({ where: { id: budgetId, userId } });
    if (!budget) throw new NotFoundException('Budget not found');
    
    // Unlink transactions
    await this.transactionRepo.update({ budgetId }, { budgetId: null });
    
    await this.budgetRepo.remove(budget);
    return { message: 'Budget deleted' };
  }

  async recalculateBudgetSpent(userId: number, budgetId: number): Promise<void> {
    const budget = await this.budgetRepo.findOne({ where: { id: budgetId, userId } });
    if (!budget) return;

    // Sum transactions explicitly linked to this budget
    const linkedTx = await this.transactionRepo.find({ 
      where: { budgetId, userId, status: TransactionStatus.APPROVED, transactionType: TransactionType.EXPENSE } 
    });
    let total = linkedTx.reduce((s, t) => s + Number(t.amount), 0);

    // If budget has a category, also include transactions with that category that AREN'T linked to another budget
    if (budget.category) {
      const catTx = await this.transactionRepo.find({
        where: { 
          category: budget.category, 
          userId, 
          status: TransactionStatus.APPROVED, 
          transactionType: TransactionType.EXPENSE,
          budgetId: IsNull() // Only if not already linked manually to another budget
        }
      });
      total += catTx.reduce((s, t) => s + Number(t.amount), 0);
    }

    budget.spent = Math.round(total * 100) / 100;
    await this.budgetRepo.save(budget);
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  async getSpendingSummary(userId: number) {
    const [expenses, income] = await Promise.all([
      this.transactionRepo.find({
        where: { userId, transactionType: TransactionType.EXPENSE, status: TransactionStatus.APPROVED },
      }),
      this.transactionRepo.find({
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

  async getSpendingByCategories(userId: number, query: AnalyticsQueryDto) {
    const where: any = {
      userId,
      transactionType: TransactionType.EXPENSE,
      status: TransactionStatus.APPROVED,
    };
    if (query.from && query.to) where.date = Between(new Date(query.from), new Date(query.to));
    else if (query.from) where.date = MoreThanOrEqual(new Date(query.from));
    else if (query.to) where.date = LessThanOrEqual(new Date(query.to));

    const transactions = await this.transactionRepo.find({ where });
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

  async getAccounts(userId: number): Promise<Account[]> {
    return this.accountRepo.find({ where: { userId } });
  }

  private assertGroupAccess(group: Group, userId: number): void {
    const isCreator = group.createdBy === userId;
    const isMember = group.members?.some((member: GroupMember) => member.userId === userId);
    if (!isCreator && !isMember) throw new ForbiddenException();
  }
}
