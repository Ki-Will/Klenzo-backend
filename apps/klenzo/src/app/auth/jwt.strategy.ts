import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { RedisService } from '../redis/redis.service';

export interface JwtPayload {
  id: number;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    super({
      // Cookie first (browser), then Authorization header (API clients / Postman)
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.kz_at ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: configService.get<string>('jwtSecret'),
      ignoreExpiration: false,
    });
  }

  /**
   * Called on every authenticated request.
   * We cache the user profile in Redis (TTL 2 min) to avoid a DB hit
   * on every single API call. The cache is invalidated on logout and
   * profile updates via RedisService.keys.userProfile(id).
   */
  async validate(payload: JwtPayload): Promise<User> {
    const cacheKey = RedisService.keys.userProfile(payload.id);

    // Try cache first
    const cached = await this.redis.get<User>(cacheKey);
    if (cached) {
      if (!cached.isActive) throw new UnauthorizedException('Account is inactive');
      return cached;
    }

    // Cache miss — hit the DB
    const user = await this.userRepository.findOne({ where: { id: payload.id } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or account is inactive');
    }

    // Cache for 2 minutes (don't cache sensitive fields like passwordHash)
    const safe = {
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
    } as User;

    await this.redis.set(cacheKey, safe, RedisService.TTL.USER_PROFILE);
    return safe;
  }
}
