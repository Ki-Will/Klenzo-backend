import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { NotificationService } from '../notification/notification.service';
import { RedisService } from '../redis/redis.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: any;
  let jwtMock: any;
  let notificationMock: any;
  let redisMock: any;

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtMock = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    notificationMock = {
      sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    };

    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: NotificationService, useValue: notificationMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if user already exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: '1', email: 'test@klenzo.com' });

      await expect(
        service.register({ email: 'test@klenzo.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should register a new user successfully and return tokens', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockImplementation(({ data }) => Promise.resolve({
        id: 'user-123',
        email: data.email,
        passwordHash: data.passwordHash,
        role: 'USER',
      }));
      prismaMock.user.update.mockResolvedValue({});

      const result = await service.register({ email: 'new@klenzo.com', password: 'password123' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('new@klenzo.com');
      expect(notificationMock.sendWelcomeEmail).toHaveBeenCalledWith('new@klenzo.com');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for non-existent user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@klenzo.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashed = await bcrypt.hash('correctPassword', 10);
      prismaMock.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@klenzo.com',
        passwordHash: hashed,
        failedLoginAttempts: 0,
        isActive: true,
      });
      prismaMock.user.update.mockResolvedValue({});

      await expect(
        service.login({ email: 'test@klenzo.com', password: 'wrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
