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
    console.log('USER:', user.email);
    console.log('ACTIVE:', user.isActive);
    console.log('FAILED ATTEMPTS:', user.failedLoginAttempts);
    console.log('HASH EXISTS:', !!user.passwordHash);

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    console.log('PASSWORD MATCH:', match);
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
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: hashedToken },
    });

    if (
      !user ||
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ) {
      throw new UnauthorizedException(
        'Invalid or expired password reset token',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        isActive: true,
      },
    });

    return { message: 'Password reset successfully' };
  }

  // ─── Profile ──────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.safeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.email && dto.email !== user.email) {
      const conflict = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (conflict) throw new ConflictException('Email already in use');
    }

    const updates: any = {};
    if (dto.email !== undefined) updates.email = dto.email;
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.phone !== undefined) updates.phone = dto.phone;
    if (dto.notificationSettings !== undefined) updates.notificationSettings = dto.notificationSettings;

    if (dto.avatar) {
      console.log('Backend: Avatar is a regular URL:', dto.avatar);
      updates.avatar = dto.avatar;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updates,
    });
    // Evict cached profile so the next JWT validation picks up the new data
    await this.redis.del(RedisService.keys.userProfile(userId));
    return this.getProfile(userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.redis.del(RedisService.keys.userProfile(userId));
    return { success: true };
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  async getSessions(userId: string) {
    const userSessions = this.sessions.get(userId) || [];
    return userSessions.map((s, idx) => ({
      id: s.id,
      device: s.device,
      location: s.location,
      lastSeen: s.lastSeen,
      isCurrent: idx === userSessions.length - 1,
    }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
  ): Promise<{ success: boolean }> {
    const existing = this.sessions.get(userId) || [];
    this.sessions.set(
      userId,
      existing.filter((s) => s.id !== sessionId),
    );
    return { success: true };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Strip sensitive fields before returning user to client */
  private safeUser(user: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    avatar: string | null;
    role: Role;
    isActive: boolean;
    lastLogin: Date | null;
    notificationSettings: any;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      phone: user.phone ?? null,
      avatar: user.avatar ?? null,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin ?? null,
      notificationSettings: user.notificationSettings ?? null,
      createdAt: user.createdAt,
    };
  }

  private trackSession(userId: string, device: string) {
    const session: Session = {
      id: crypto.randomUUID(),
      device,
      location: 'Unknown',
      lastSeen: new Date(),
    };
    const existing = this.sessions.get(userId) || [];
    // Keep last 5 sessions per user
    const updated = [...existing, session].slice(-5);
    this.sessions.set(userId, updated);
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashed, refreshTokenExpires: expires },
    });
    return token;
  }
}
