import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType, Role } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // ─── Platform Statistics ──────────────────────────────────────────────────

  async getStats() {
    const [
      totalUsers,
      activeUsers,
      totalTransactions,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.transaction.count(),
    ]);

    // Transaction volume
    const volumeResult = await this.prisma.transaction.aggregate({
      where: { transactionType: TransactionType.EXPENSE },
      _sum: { amount: true },
    });
    const transactionVolume = Math.round(Number(volumeResult._sum.amount || 0));

    // Active sessions (users logged in last 15 min)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const activeSessions = await this.prisma.user.count({
      where: { lastLogin: { gte: fifteenMinutesAgo } },
    });

    // User growth (last 30 days vs previous 30)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [lastMonthUsers, prevPeriodUsers] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: sixtyDaysAgo } } }),
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

      const result = await this.prisma.transaction.aggregate({
        where: {
          date: { gte: start, lt: end },
          transactionType: TransactionType.EXPENSE,
        },
        _sum: { amount: true },
      });
      monthlyRevenue.push(Math.round(Number(result._sum.amount || 0)));
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

    const where: any = {};
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    // Enrich each user with transaction stats
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const txCount = await this.prisma.transaction.count({
          where: { userId: user.id },
        });
        const volumeResult = await this.prisma.transaction.aggregate({
          where: { userId: user.id },
          _sum: { amount: true },
        });
        return {
          ...user,
          transactionCount: txCount,
          totalVolume: Math.round(Number(volumeResult._sum.amount || 0)),
        };
      }),
    );

    return {
      users: enrichedUsers,
      total,
    };
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        failedLoginAttempts: true,
        phone: true,
        avatar: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async toggleUserActive(userId: string, active: boolean): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: active },
    });
    return { success: true };
  }

  async deleteUser(userId: string, currentUserId: string): Promise<{ success: boolean }> {
    if (userId === currentUserId) {
      throw new BadRequestException('Cannot delete yourself');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === Role.SUPERADMIN) {
      throw new ForbiddenException('Cannot delete superadmin users');
    }
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  // ─── Admin Management ─────────────────────────────────────────────────────

  async getAdmins() {
    return this.prisma.user.findMany({
      where: {
        OR: [{ role: Role.ADMIN }, { role: Role.SUPERADMIN }],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAdmin(
    dto: { email: string; password: string; name: string; role: 'admin' | 'superadmin' },
    currentAdmin: { id: string; role: Role },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already in use');

    if (dto.role === 'superadmin' && currentAdmin.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only superadmins can create superadmins');
    }
    if (!['admin', 'superadmin'].includes(dto.role)) {
      throw new BadRequestException('Role must be admin or superadmin');
    }

    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const saved = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: dto.role === 'superadmin' ? Role.SUPERADMIN : Role.ADMIN,
        isActive: true,
      },
    });

    return {
      id: saved.id,
      email: saved.email,
      name: saved.name,
      role: saved.role,
      isActive: saved.isActive,
      createdAt: saved.createdAt,
    };
  }

  async getAllActiveUsers(): Promise<{ id: string; email: string }[]> {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true },
    });
  }

  async deleteAdmin(adminId: string, currentAdmin: { id: string; role: Role }): Promise<{ success: boolean }> {
    if (adminId === currentAdmin.id) {
      throw new BadRequestException('Cannot delete yourself');
    }
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');
    if (admin.role === Role.SUPERADMIN) {
      throw new ForbiddenException('Cannot delete superadmin users');
    }
    await this.prisma.user.delete({ where: { id: adminId } });
    return { success: true };
  }
}
