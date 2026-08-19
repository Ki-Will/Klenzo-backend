import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Role } from '@prisma/client';

export interface JwtPayload {
  id: string;
  email: string;
}

export interface UserPayload {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatar: string | null;
  role: Role;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super({
      // Cookie first (browser), then Authorization header (API clients / Postman)
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.kz_at ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: process.env.JWT_SECRET || 'KlenzoSecret',
      ignoreExpiration: false,
    });
  }

  /**
   * Called on every authenticated request.
   * We cache the user profile in Redis (TTL 2 min) to avoid a DB hit
   * on every single API call. The cache is invalidated on logout and
   * profile updates via RedisService.keys.userProfile(id).
   */
  async validate(payload: JwtPayload): Promise<UserPayload> {
    const cacheKey = RedisService.keys.userProfile(payload.id);

    // Try cache first
    const cached = await this.redis.get<UserPayload>(cacheKey);
    if (cached) {
      if (!cached.isActive) throw new UnauthorizedException('Account is inactive');
      return cached;
    }

    // Cache miss — hit the DB
    const user = await this.prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or account is inactive');
    }

    // Cache for 2 minutes (don't cache sensitive fields like passwordHash)
    const safe: UserPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    await this.redis.set(cacheKey, safe, RedisService.TTL.USER_PROFILE);
    return safe;
  }
}
