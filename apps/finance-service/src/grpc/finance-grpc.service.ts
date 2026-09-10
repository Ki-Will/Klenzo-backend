import { Injectable, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PrismaService } from '../../../klenzo/src/app/prisma/prisma.service';

@Injectable()
export class FinanceGrpcService {
  private readonly logger = new Logger(FinanceGrpcService.name);

  constructor(private readonly prisma: PrismaService) {}

  @GrpcMethod('FinanceService', 'GetUserWalletBalance')
  async getUserWalletBalance(data: { userId: string }) {
    try {
      const wallet = await this.prisma.wallet.findFirst({
        where: { userId: data.userId },
        select: {
          balance: true,
          currency: true,
        },
      });

      if (!wallet) {
        return {
          userId: data.userId,
          mainWalletBalance: 0,
          currency: 'USD',
        };
      }

      return {
        userId: data.userId,
        mainWalletBalance: Number(wallet.balance),
        currency: wallet.currency,
      };
    } catch (err) {
      this.logger.error(`Failed to get wallet balance: ${err.message}`);
      return {
        userId: data.userId,
        mainWalletBalance: 0,
        currency: 'USD',
      };
    }
  }
}
