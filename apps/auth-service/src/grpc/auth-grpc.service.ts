import { Injectable, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
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
  async validateToken(data: { token: string }) {
    try {
      const payload = this.jwtService.verify(data.token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        return { isValid: false, userId: '', role: '' };
      }

      return {
        isValid: true,
        userId: user.id,
        role: user.role,
      };
    } catch (err) {
      this.logger.debug(`Token validation failed: ${err.message}`);
      return { isValid: false, userId: '', role: '' };
    }
  }

  @GrpcMethod('AuthService', 'GetUserProfile')
  async getUserProfile(data: { userId: string }) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
        },
      });

      if (!user) {
        return {
          id: '',
          email: '',
          name: '',
          role: '',
          isActive: false,
        };
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role,
        isActive: user.isActive,
      };
    } catch (err) {
      this.logger.error(`Failed to get user profile: ${err.message}`);
      return {
        id: '',
        email: '',
        name: '',
        role: '',
        isActive: false,
      };
    }
  }
}
