import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  @Get()
  async getTransfers(@Req() req: any) {
    return {
      transfers: [
        {
          id: 'tr-001',
          recipient: 'Alice Smith',
          amount: 150.00,
          currency: 'USD',
          type: 'P2P',
          status: 'COMPLETED',
          date: new Date().toISOString(),
        },
        {
          id: 'tr-002',
          recipient: 'MTN Mobile (+250780000000)',
          amount: 45.00,
          currency: 'USD',
          type: 'MOBILE_MONEY',
          status: 'COMPLETED',
          date: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
    };
  }

  @Post()
  async initiateTransfer(
    @Req() req: any,
    @Body() dto: { recipient: string; amount: number; type?: string; note?: string },
  ) {
    return {
      id: 'tr-' + Date.now(),
      senderId: req.user.id,
      recipient: dto.recipient,
      amount: dto.amount,
      currency: 'USD',
      type: dto.type || 'P2P',
      status: 'COMPLETED',
      reference: 'REF-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      date: new Date().toISOString(),
    };
  }
}
