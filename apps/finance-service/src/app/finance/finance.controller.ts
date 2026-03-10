import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { FinanceService } from './finance.service';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('transactions')
  async createTransaction(@Body() body: { userId: number; amount: number; description?: string; category?: string; transactionType: 'income' | 'expense'; date: string }) {
    return this.financeService.createTransaction(body.userId, {
      amount: body.amount,
      description: body.description,
      category: body.category,
      transactionType: body.transactionType,
      date: body.date,
    });
  }

  @Get('transactions/:userId')
  async getTransactions(@Param('userId') userId: string) {
    return this.financeService.getTransactions(+userId);
  }
}
