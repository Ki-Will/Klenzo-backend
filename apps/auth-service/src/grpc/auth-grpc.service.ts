import { Injectable, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type {
  GetUserProfileRequest,
  GetUserProfileResponse,
  ValidateTokenRequest,
  ValidateTokenResponse,
} from '@klenzo/contracts';
import { PrismaService } from '../../../klenzo/src/app/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGrpcService {
  private readonly logger = new Logger(AuthGrpcService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  @GrpcMethod('AuthService', 'ValidateToken')
  async validateToken(
    data: ValidateTokenRequest,
  ): Promise<ValidateTokenResponse> {
    try {
      const payload = this.jwtService.verify(data.token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        return {
          isValid: false,
          userId: '',
          email: '',
          role: '',
          isActive: false,
        };
      }

      return {
        isValid: true,
        userId: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      };
    } catch (err) {
      this.logger.debug(`Token validation failed: ${err.message}`);
      return {
        isValid: false,
        userId: '',
        email: '',
        role: '',
        isActive: false,
      };
    }
  }

  @GrpcMethod('AuthService', 'GetUserProfile')
  async getUserProfile(
    data: GetUserProfileRequest,
  ): Promise<GetUserProfileResponse> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatar: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      if (!user) {
        return emptyProfile();
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name || '',
        phone: user.phone || '',
        avatar: user.avatar || '',
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      };
    } catch (err) {
      this.logger.error(`Failed to get user profile: ${err.message}`);
      return emptyProfile();
    }
  }
}

function emptyProfile(): GetUserProfileResponse {
  return {
    id: '',
    email: '',
    name: '',
    phone: '',
    avatar: '',
    role: '',
    isActive: false,
    createdAt: '',
  };
}
