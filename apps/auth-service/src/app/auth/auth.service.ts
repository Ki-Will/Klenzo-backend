import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { EventBusService } from '@klenzo/messaging';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterUserDto } from '../dto/register-user.dto';
import { LoginUserDto } from '../dto/login-user.dto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private eventBus: EventBusService,
    private jwtService: JwtService,
  ) {}

  async register(registerUserDto: RegisterUserDto): Promise<{ message: string }> {
    const { email, password } = registerUserDto;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      email,
      passwordHash: hashedPassword,
    });
    const savedUser = await this.userRepository.save(user);
    this.eventBus.publish('user.created', { userId: savedUser.id, email: savedUser.email });
    return { message: 'User registered' };
  }

  async login(loginUserDto: LoginUserDto): Promise<{ accessToken: string; refreshToken: string }> {
    const { email, password } = loginUserDto;
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is locked');
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      user.failedLoginAttempts++;
      if (user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        user.isActive = false;
      }
      await this.userRepository.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    user.failedLoginAttempts = 0;
    user.lastLogin = new Date();
    await this.userRepository.save(user);

    const payload: JwtPayload = { id: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(user.id);
    this.eventBus.publish('user.logged_in', { userId: user.id, email: user.email });
    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const user = await this.userRepository.findOne({ where: { refreshToken: hashedRefreshToken } });
    if (!user || user.refreshTokenExpires < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const payload: JwtPayload = { id: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 1);
    await this.userRepository.update(user.id, { passwordResetToken: hashedResetToken, passwordResetExpires: expiryDate });
    this.eventBus.publish('user.password_reset_request', { userId: user.id, email: user.email, resetToken });
    return { message: 'Password reset email sent' };
  }

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.userRepository.findOne({ where: { passwordResetToken: hashedToken } });
    if (!user || user.passwordResetExpires < new Date()) {
      throw new UnauthorizedException('Invalid or expired password reset token');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await this.userRepository.update(user.id, { 
      passwordHash: hashedPassword, 
      passwordResetToken: null as any, 
      passwordResetExpires: null as any, 
      failedLoginAttempts: 0, 
      isActive: true 
    });
    this.eventBus.publish('user.password_reset_success', { userId: user.id, email: user.email });
    return { message: 'Password has been reset' };
  }

  async validateUserById(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private async generateRefreshToken(userId: number): Promise<string> {
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);
    await this.userRepository.update(userId, { refreshToken: hashedRefreshToken, refreshTokenExpires: expiryDate });
    return refreshToken;
  }
}
