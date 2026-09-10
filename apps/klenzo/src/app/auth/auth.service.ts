import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto, LoginDto, UpdateProfileDto } from '../dto/auth.dto';
import { JwtPayload } from './jwt.strategy';
import { NotificationService } from '../notification/notification.service';
import { RedisService } from '../redis/redis.service';
import { Role } from '@prisma/client';

const MAX_FAILED_ATTEMPTS = 5;

// In-memory session store — replace with Redis for multi-instance deployments
interface Session {
  id: string;
  device: string;
  location: string;
  lastSeen: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private sessions = new Map<string, Session[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notificationService: NotificationService,
    private readonly redis: RedisService,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────
  // Auto-login: returns tokens + user profile so the frontend can skip a
  // separate login call after registration.

  async register(dto: RegisterDto, device?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const saved = await this.prisma.user.create({
      data: { email: dto.email, passwordHash },
    });

    this.notificationService
      .sendWelcomeEmail(saved.email)
      .catch((err) => this.logger.error('Welcome email failed', err?.stack));

    this.trackSession(saved.id, device || 'Unknown device');

    const payload: JwtPayload = { id: saved.id, email: saved.email };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(saved.id);

    return {
      message: 'Registration successful',
      accessToken,
      refreshToken,
      user: this.safeUser(saved),
    };
  }

  // ─── Login ────────────────────────────────────────────────────────────────
  // Returns user profile inline so the frontend doesn't need GET /profile
  // immediately after login (fixes race condition / 401 on first request).

  async login(dto: LoginDto, device?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Account is locked. Reset your password to regain access.',
      );
    }

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) {
      const newFailedAttempts = user.failedLoginAttempts + 1;
      if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { isActive: false, failedLoginAttempts: newFailedAttempts },
        });
        this.logger.warn(`Account locked: ${user.email}`);
        this.notificationService
          .sendAccountLockedEmail(user.email)
          .catch((err) => this.logger.error('Lock email failed', err?.stack));
      } else {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: newFailedAttempts },
        });
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lastLogin: new Date() },
    });

    this.trackSession(user.id, device || 'Unknown device');

    const payload: JwtPayload = { id: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: this.safeUser(user),
    };
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  async refresh(refreshToken: string) {
    const hashed = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const user = await this.prisma.user.findFirst({
      where: { refreshToken: hashed },
    });

    if (
      !user ||
      !user.refreshTokenExpires ||
      user.refreshTokenExpires < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const payload: JwtPayload = { id: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    const newRefreshToken = await this.generateRefreshToken(user.id);

    return { accessToken, refreshToken: newRefreshToken };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null, refreshTokenExpires: null },
    });
    this.sessions.delete(userId);
    // Evict cached profile so the next request re-validates from DB
    await this.redis.del(RedisService.keys.userProfile(userId));
  }

  // ─── Forgot / Reset password ──────────────────────────────────────────────

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return the same message to avoid email enumeration
    if (!user)
      return { message: 'If that email exists, a reset link has been sent' };

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: hashedToken, passwordResetExpires: expires },
    });

    this.notificationService
      .sendPasswordResetEmail(user.email, resetToken)
      .catch((err) => this.logger.error('Reset email failed', err?.stack));

    return { message: 'If that email exists, a reset link has been sent' };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        isActive: true, // unlock if account was locked
      },
    });

    return { message: 'Password reset successful' };
  }

  // ─── Profile ──────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.safeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });

    // Invalidate cached profile
    await this.redis.del(RedisService.keys.userProfile(userId));

    return this.safeUser(user);
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const match = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate cached profile
    await this.redis.del(RedisService.keys.userProfile(userId));

    return { message: 'Password changed successfully' };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private safeUser(user: any) {
    const { passwordHash, refreshToken, passwordResetToken, ...safe } = user;
    return safe;
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(40).toString('hex');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // 7 days

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashed, refreshTokenExpires: expires },
    });

    return token;
  }

  private trackSession(userId: string, device: string) {
    const sessions = this.sessions.get(userId) || [];
    sessions.push({
      id: crypto.randomUUID(),
      device,
      location: 'Unknown',
      lastSeen: new Date(),
    });
    // Keep only last 10 sessions
    if (sessions.length > 10) sessions.shift();
    this.sessions.set(userId, sessions);
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────
  async getSessions(userId: string) {
    return this.sessions.get(userId) || [];
  }

  async revokeSession(userId: string, sessionId: string) {
    const userSessions = this.sessions.get(userId) || [];
    const updated = userSessions.filter((s) => s.id !== sessionId);
    this.sessions.set(userId, updated);
    return { message: "Session revoked successfully" };
  }

  // ─── Admin: list users ────────────────────────────────────────────────────
  async listUsers() {
    const users = await this.prisma.user.findMany({
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
    });
    return users;
  }
}
