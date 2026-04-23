import { Controller, Post, Get, Body, Param, UsePipes, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FinanceService } from './finance.service';
import { CreateGroupDto } from '../dto/create-group.dto';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('transactions')
  async createTransaction(@Body() body: { userId: number; amount: number; description?: string; category?: string; transactionType: 'income' | 'expense'; date: string; groupId?: number }) {
    return this.financeService.createTransaction(body.userId, body);
  }

  @Get('transactions/:userId')
  async getTransactions(@Param('userId') userId: string) {
    return this.financeService.getTransactions(+userId);
  }

  // Group Endpoints
  @Post('groups')
  @UsePipes(new ValidationPipe())
  async createGroup(@Body() body: { userId: number; dto: CreateGroupDto }) {
    return this.financeService.createGroup(body.userId, body.dto);
  }

  @Get('groups/:userId')
  async getGroups(@Param('userId') userId: string) {
    return this.financeService.getGroups(+userId);
  }

  @Get('groups/detail/:id')
  async getGroupDetail(@Param('id') id: string) {
    return this.financeService.getGroupDetail(+id);
  }

  // Analytics Endpoints
  @Get('analytics/summary/:userId')
  async getSpendingSummary(@Param('userId') userId: string) {
    return this.financeService.getSpendingSummary(+userId);
  }
}
