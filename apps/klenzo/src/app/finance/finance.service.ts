import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Transaction, TransactionStatus, TransactionType } from '../entities/transaction.entity';
import { Group, GroupMember } from '../entities/group.entity';
import { Budget } from '../entities/budget.entity';
import { Account } from '../entities/account.entity';
import { User } from '../entities/user.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';
import { InsightService } from '../insight/insight.service';
import {
  CreateTransactionDto,
  CreateGroupDto,
  CreateBudgetDto,
  UpdateBudgetDto,
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

    // Only update budget for approved personal expenses
    if (
      saved.status === TransactionStatus.APPROVED &&
      dto.transactionType === TransactionType.EXPENSE &&
      dto.category
    ) {
      const budget = await this.budgetRepo.findOne({ where: { userId, category: dto.category } });
      if (budget) {
        budget.spent = Number(budget.spent) + Number(dto.amount);
        await this.budgetRepo.save(budget);

        if (Number(budget.spent) > Number(budget.limitAmount)) {
          this.notificationService.createNotification({
            userId,
            title: '⚠️ Budget Exceeded',
            message: `You exceeded your ${budget.category} budget of ${budget.limitAmount}. Spent: ${budget.spent}.`,
            type: NotificationType.WARNING,
          }).catch(() => null);
        }
      }
    }

    this.insightService.invalidateDashboard(userId).catch(() => null);
    return saved;
  }

  /**
   * Returns only APPROVED transactions for the user's personal view.
   * Pending splits are excluded until the user approves them.
   */
  async getTransactions(userId: number): Promise<Transaction[]> {
    return this.transactionRepo.find({
      where: { userId, status: TransactionStatus.APPROVED },
      order: { date: 'DESC' },
    });
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
    await this.transactionRepo.remove(tx);
    this.insightService.invalidateDashboard(userId).catch(() => null);
    return { message: 'Transaction deleted' };
  }

  /**
   * Approve a pending split transaction.
   * Only the transaction's owner can approve it.
   * Once approved it counts in personal expenses and balance calculations.
   */
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

    // Now that it's approved, update the budget
    if (tx.transactionType === TransactionType.EXPENSE && tx.category) {
      const budget = await this.budgetRepo.findOne({ where: { userId, category: tx.category } });
      if (budget) {
        budget.spent = Number(budget.spent) + Number(tx.amount);
        await this.budgetRepo.save(budget);
      }
    }

    this.insightService.invalidateDashboard(userId).catch(() => null);
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
    }).catch(() => null);

    return this.groupRepo.findOne({
      where: { id: savedGroup.id },
      relations: ['members', 'transactions'],
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

  async getGroupDetail(userId: number, groupId: string): Promise<Group> {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['members', 'transactions'],
    });
    if (!group) throw new NotFoundException('Group not found');
    if (group.createdBy !== userId) throw new ForbiddenException();
    return group;
  }

  /**
   * GET /finance/groups/:id/transactions
   * Returns ALL transactions for the group (approved + pending) so the
   * group detail page can show the full picture including pending approvals.
   */
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
      throw new NotFoundException(`User "${email}" not found. They must register first.`);
    }
    if (group.members.find((m) => m.userId === userToAdd.id)) {
      throw new BadRequestException(`"${email}" is already a member of this group.`);
    }

    await this.groupMemberRepo.save(
      this.groupMemberRepo.create({ email, userId: userToAdd.id, groupId }),
    );

    return this.groupRepo.findOne({ where: { id: groupId }, relations: ['members'] }) as Promise<Group>;
  }

  async removeGroupMember(userId: number, groupId: string, memberId: number): Promise<{ message: string }> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.createdBy !== userId) throw new ForbiddenException();

    const member = await this.groupMemberRepo.findOne({ where: { id: memberId, groupId } });
    if (!member) throw new NotFoundException('Member not found in this group');
    if (member.userId === group.createdBy) {
      throw new BadRequestException('The group creator cannot be removed from the group.');
    }

    await this.groupMemberRepo.remove(member);
    return { message: 'Member removed' };
  }

  async deleteGroup(userId: number, groupId: string): Promise<{ message: string }> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.createdBy !== userId) throw new ForbiddenException();
    await this.groupRepo.remove(group);
    return { message: 'Group deleted' };
  }

  /**
   * Returns a flat array of balance objects — consistent shape, numeric values.
   * Only counts APPROVED transactions.
   */
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
      if (net[tx.userId] !== undefined) {
        net[tx.userId].balance += Number(tx.amount) - share;
      }
      for (const m of group.members) {
        if (m.userId !== tx.userId && net[m.userId] !== undefined) {
          net[m.userId].balance -= share;
        }
      }
    }

    // Return flat array with rounded numeric balances
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
    const saved = await this.budgetRepo.save(this.budgetRepo.create({ ...dto, userId }));
    this.notificationService.createNotification({
      userId,
      title: '📊 Budget Created',
      message: `Budget for "${saved.category}" set at ${saved.limitAmount} (${saved.period}).`,
      type: NotificationType.INFO,
    }).catch(() => null);
    return saved;
  }

  async getBudgets(userId: number): Promise<Budget[]> {
    return this.budgetRepo.find({ where: { userId } });
  }

  async updateBudget(userId: number, budgetId: number, dto: UpdateBudgetDto): Promise<Budget> {
    const budget = await this.budgetRepo.findOne({ where: { id: budgetId } });
    if (!budget) throw new NotFoundException('Budget not found');
    if (budget.userId !== userId) throw new ForbiddenException();
    Object.assign(budget, dto);
    return this.budgetRepo.save(budget);
  }

  async deleteBudget(userId: number, budgetId: number): Promise<{ message: string }> {
    const budget = await this.budgetRepo.findOne({ where: { id: budgetId } });
    if (!budget) throw new NotFoundException('Budget not found');
    if (budget.userId !== userId) throw new ForbiddenException();
    await this.budgetRepo.remove(budget);
    this.notificationService.createNotification({
      userId,
      title: 'Budget Deleted',
      message: `Your "${budget.category}" budget has been removed.`,
      type: NotificationType.INFO,
    }).catch(() => null);
    return { message: 'Budget deleted' };
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

    const change = lastMonth > 0
      ? Math.round(((thisMonth - lastMonth) / lastMonth) * 1000) / 10
      : 0;

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

  // ─── Accounts ─────────────────────────────────────────────────────────────

  async getAccounts(userId: number): Promise<Account[]> {
    return this.accountRepo.find({ where: { userId } });
  }

  private assertGroupAccess(group: Group, userId: number): void {
    const isCreator = group.createdBy === userId;
    const isMember = group.members?.some((member) => member.userId === userId);
    if (!isCreator && !isMember) throw new ForbiddenException();
  }
}
