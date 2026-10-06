import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletController {
  @Get()
  async getWallets(@Req() req: any) {
    const userId = req.user.id;
    return {
      wallets: [
        {
          id: 'w-main-' + userId,
          name: 'Main Wallet',
          currency: 'USD',
          balance: 2450.50,
          accountNumber: '1092837465',
          isPrimary: true,
          status: 'ACTIVE',
        },
        {
          id: 'w-savings-' + userId,
          name: 'Savings Vault',
          currency: 'USD',
          balance: 12000.00,
          accountNumber: '9081726354',
          isPrimary: false,
          status: 'ACTIVE',
        },
      ],
    };
  }

  @Post()
  async createWallet(@Req() req: any, @Body() body: { name: string; currency?: string }) {
    return {
      id: 'w-' + Date.now(),
      name: body.name || 'Secondary Wallet',
      currency: body.currency || 'USD',
      balance: 0,
      accountNumber: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
      isPrimary: false,
      status: 'ACTIVE',
    };
  }
}
