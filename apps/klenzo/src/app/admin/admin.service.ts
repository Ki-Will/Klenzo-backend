import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '../entities/user.entity';
import { Task } from '../entities/task.entity';
import { Habit } from '../entities/habit.entity';
import { Transaction, TransactionType } from '../entities/transaction.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Habit)
    private readonly habitRepository: Repository<Habit>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  // ─── Platform Statistics ──────────────────────────────────────────────────

  async getStats() {
    const [
      totalUsers,
      activeUsers,
      totalTransactions,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
      this.transactionRepository.count(),
    ]);

    // Transaction volume
    const volumeResult = await this.transactionRepository
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'volume')
      .where('tx.transactionType = :type', { type: TransactionType.EXPENSE })
      .getRawOne();
    const transactionVolume = Math.round(Number(volumeResult?.volume || 0));

    // Active sessions (users logged in last 15 min)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const activeSessions = await this.userRepository.count({
      where: { lastLogin: MoreThan(fifteenMinutesAgo) },
    });

    // User growth (last 30 days vs previous 30)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [lastMonthUsers, prevPeriodUsers] = await Promise.all([
      this.userRepository.count({ where: { createdAt: MoreThan(thirtyDaysAgo) } }),
      this.userRepository.count({
        where: { createdAt: MoreThan(sixtyDaysAgo) },
      }),
    ]);
    const prevCount = prevPeriodUsers - lastMonthUsers;
    const userGrowth = prevCount > 0
      ? Math.round(((lastMonthUsers - prevCount) / prevCount) * 1000) / 10
      : lastMonthUsers > 0 ? 100 : 0;

    const revenueGrowth = Math.round((Math.random() * 20 + 5) * 10) / 10; // placeholder

    // Monthly revenue (last 12 months)
    const monthlyRevenue: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);

      const result = await this.transactionRepository
        .createQueryBuilder('tx')
        .select('COALESCE(SUM(tx.amount), 0)', 'monthVolume')
        .where('tx.date >= :start AND tx.date < :end', { start, end })
        .andWhere('tx.transactionType = :type', { type: TransactionType.EXPENSE })
        .getRawOne();
      monthlyRevenue.push(Math.round(Number(result?.monthVolume || 0)));
    }

    return {
      totalUsers,
      activeUsers,
      totalTransactions,
      transactionVolume,
      activeSessions,
      systemHealth: 99.9,
      userGrowth,
      revenueGrowth,
      monthlyRevenue,
    };
  }

  // ─── User Management ──────────────────────────────────────────────────────

  async getUsers(query: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 100);
    const skip = (page - 1) * limit;

    const qb = this.userRepository.createQueryBuilder('user');

    if (query.search) {
      qb.andWhere('user.email ILIKE :search OR user.name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    qb.select([
      'user.id',
      'user.email',
      'user.name',
      'user.role',
      'user.isActive',
      'user.createdAt',
      'user.lastLogin',
    ])
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [users, total] = await qb.getManyAndCount();

    // Enrich each user with transaction stats
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const txCount = await this.transactionRepository.count({
          where: { userId: user.id },
        });
        const volumeResult = await this.transactionRepository
          .createQueryBuilder('tx')
          .select('COALESCE(SUM(tx.amount), 0)', 'volume')
          .where('tx.userId = :userId', { userId: user.id })
          .getRawOne();
        return {
          ...user,
          transactionCount: txCount,
          totalVolume: Math.round(Number(volumeResult?.volume || 0)),
        };
      }),
    );

    return {
      users: enrichedUsers,
      total,
    };
  }

  async getUserById(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id', 'email', 'name', 'role', 'isActive',
        'createdAt', 'updatedAt', 'lastLogin', 'failedLoginAttempts',
        'phone', 'avatar',
      ],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async toggleUserActive(userId: number, active: boolean): Promise<{ success: boolean }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepository.update(userId, { isActive: active });
    return { success: true };
  }

  async deleteUser(userId: number, currentUserId: number): Promise<{ success: boolean }> {
    if (userId === currentUserId) {
      throw new BadRequestException('Cannot delete yourself');
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'superadmin') {
      throw new ForbiddenException('Cannot delete superadmin users');
    }
    await this.userRepository.remove(user);
    return { success: true };
  }

  // ─── Admin Management ─────────────────────────────────────────────────────

  async getAdmins() {
    return this.userRepository.find({
      where: [{ role: 'admin' }, { role: 'superadmin' }],
      select: ['id', 'email', 'name', 'role', 'isActive', 'lastLogin', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async createAdmin(
    dto: { email: string; password: string; name: string; role: 'admin' | 'superadmin' },
    currentAdmin: User,
  ) {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already in use');

    if (dto.role === 'superadmin' && currentAdmin.role !== 'superadmin') {
      throw new ForbiddenException('Only superadmins can create superadmins');
    }
    if (!['admin', 'superadmin'].includes(dto.role)) {
      throw new BadRequestException('Role must be admin or superadmin');
    }

    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const admin = this.userRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role,
      isActive: true,
    });
    const saved = await this.userRepository.save(admin);

    return {
      id: saved.id,
      email: saved.email,
      name: saved.name,
      role: saved.role,
      isActive: saved.isActive,
      createdAt: saved.createdAt,
    };
  }

  async getAllActiveUsers(): Promise<{ id: number; email: string }[]> {
    return this.userRepository.find({
      where: { isActive: true },
      select: ['id', 'email'],
    });
  }

  async deleteAdmin(adminId: number, currentAdmin: User): Promise<{ success: boolean }> {
    if (adminId === currentAdmin.id) {
      throw new BadRequestException('Cannot delete yourself');
    }
    const admin = await this.userRepository.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');
    if (admin.role === 'superadmin') {
      throw new ForbiddenException('Cannot delete superadmin users');
    }
    await this.userRepository.remove(admin);
    return { success: true };
  }
}