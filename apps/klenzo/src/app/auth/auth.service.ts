import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { RegisterDto, LoginDto, UpdateProfileDto } from '../dto/auth.dto';
import { JwtPayload } from './jwt.strategy';
import { NotificationService } from '../notification/notification.service';
import { RedisService } from '../redis/redis.service';

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
  private sessions = new Map<number, Session[]>();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly notificationService: NotificationService,
    private readonly redis: RedisService,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────
  // Auto-login: returns tokens + user profile so the frontend can skip a
  // separate login call after registration.

  async register(dto: RegisterDto, device?: string) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({ email: dto.email, passwordHash });
    const saved = await this.userRepository.save(user);

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
    const user = await this.userRepository.findOne({
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

    // const match = await bcrypt.compare(dto.password, user.passwordHash);

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    console.log('PASSWORD MATCH:', match);
    if (!match) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.isActive = false;
        this.logger.warn(`Account locked: ${user.email}`);
        this.notificationService
          .sendAccountLockedEmail(user.email)
          .catch((err) => this.logger.error('Lock email failed', err?.stack));
      }
      await this.userRepository.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    user.failedLoginAttempts = 0;
    user.lastLogin = new Date();
    await this.userRepository.save(user);

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
    const user = await this.userRepository.findOne({
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

  async logout(userId: number): Promise<void> {
    await this.userRepository.update(userId, {
      refreshToken: null as any,
      refreshTokenExpires: null as any,
    });
    this.sessions.delete(userId);
    // Evict cached profile so the next request re-validates from DB
    await this.redis.del(RedisService.keys.userProfile(userId));
  }

  // ─── Forgot / Reset password ──────────────────────────────────────────────

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email } });
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

    await this.userRepository.update(user.id, {
      passwordResetToken: hashedToken,
      passwordResetExpires: expires,
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
    const user = await this.userRepository.findOne({
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
    await this.userRepository.update(user.id, {
      passwordHash,
      passwordResetToken: null as any,
      passwordResetExpires: null as any,
      failedLoginAttempts: 0,
      isActive: true,
    });

    return { message: 'Password reset successfully' };
  }

  // ─── Profile ──────────────────────────────────────────────────────────────

  async getProfile(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.safeUser(user);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.email && dto.email !== user.email) {
      const conflict = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (conflict) throw new ConflictException('Email already in use');
    }

    const updates: Partial<User> = {};
    if (dto.email !== undefined) updates.email = dto.email;
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.phone !== undefined) updates.phone = dto.phone;

    if (dto.avatar) {
      console.log('Backend: Avatar is a regular URL:', dto.avatar);
      updates.avatar = dto.avatar;
    }

    await this.userRepository.update(userId, updates);
    // Evict cached profile so the next JWT validation picks up the new data
    await this.redis.del(RedisService.keys.userProfile(userId));
    return this.getProfile(userId);
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.update(userId, { passwordHash });
    await this.redis.del(RedisService.keys.userProfile(userId));
    return { success: true };
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  async getSessions(userId: number) {
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
    userId: number,
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
  private safeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      phone: user.phone ?? null,
      avatar: user.avatar ?? null,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin ?? null,
      createdAt: user.createdAt,
    };
  }

  private trackSession(userId: number, device: string) {
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

  private async generateRefreshToken(userId: number): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    await this.userRepository.update(userId, {
      refreshToken: hashed,
      refreshTokenExpires: expires,
    });
    return token;
  }
}
