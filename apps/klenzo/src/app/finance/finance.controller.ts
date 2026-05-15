import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import {
  CreateTransactionDto,
  CreateGroupDto,
  CreateBudgetDto,
  UpdateBudgetDto,
  UpdateTransactionDto,
  AnalyticsQueryDto,
} from '../dto/finance.dto';

@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ─── Transactions ─────────────────────────────────────────────────────────

  @Post('transactions')
  @HttpCode(HttpStatus.CREATED)
  createTransaction(@CurrentUser() user: User, @Body() dto: CreateTransactionDto) {
    return this.financeService.createTransaction(user.id, dto);
  }

  /** Returns only APPROVED transactions for the user's personal view */
  @Get('transactions')
  getTransactions(@CurrentUser() user: User) {
    return this.financeService.getTransactions(user.id);
  }

  @Get('transactions/:id')
  getTransaction(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.financeService.getTransaction(user.id, id);
  }

  @Delete('transactions/:id')
  @HttpCode(HttpStatus.OK)
  deleteTransaction(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.financeService.deleteTransaction(user.id, id);
  }

  @Patch('transactions/:id')
  @HttpCode(HttpStatus.OK)
  updateTransaction(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.financeService.updateTransaction(user.id, id, dto);
  }

  /**
   * POST /finance/transactions/:id/approve
   * Flip a pending split transaction to approved.
   * Only the transaction's owner can approve it.
   */
  @Post('transactions/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveTransaction(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.financeService.approveTransaction(user.id, id);
  }

  // ─── Groups ───────────────────────────────────────────────────────────────

  @Post('groups')
  @HttpCode(HttpStatus.CREATED)
  createGroup(@CurrentUser() user: User, @Body() dto: CreateGroupDto) {
    return this.financeService.createGroup(user.id, dto);
  }

  @Get('groups')
  getGroups(@CurrentUser() user: User) {
    return this.financeService.getGroups(user.id);
  }

  @Get('groups/:id')
  getGroupDetail(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.financeService.getGroupDetail(user.id, id);
  }

  /**
   * GET /finance/groups/:id/transactions
   * All transactions for the group — both approved and pending.
   */
  @Get('groups/:id/transactions')
  getGroupTransactions(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.financeService.getGroupTransactions(user.id, id);
  }

  @Post('groups/:id/members')
  @HttpCode(HttpStatus.OK)
  addGroupMember(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('email') email: string,
  ) {
    return this.financeService.addGroupMember(user.id, id, email);
  }

  @Delete('groups/:id/members/:memberId')
  @HttpCode(HttpStatus.OK)
  removeGroupMember(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseIntPipe) memberId: number,
  ) {
    return this.financeService.removeGroupMember(user.id, id, memberId);
  }

  @Patch('groups/:id')
  @HttpCode(HttpStatus.OK)
  updateGroup(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('name') name: string,
  ) {
    return this.financeService.updateGroup(user.id, id, name);
  }

  @Delete('groups/:id')
  @HttpCode(HttpStatus.OK)
  deleteGroup(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.financeService.deleteGroup(user.id, id);
  }

  /**
   * GET /finance/groups/:id/balances
   * Returns a flat array: [{ userId, name, balance, status }]
   * balance is always a number (never a string).
   */
  @Get('groups/:id/balances')
  getGroupBalances(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.financeService.getGroupBalances(user.id, id);
  }

  @Post('groups/:id/settle')
  @HttpCode(HttpStatus.OK)
  settleGroup(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('amount') amount: number,
  ) {
    return this.financeService.settleGroup(user.id, id, amount);
  }

  // ─── Budgets ──────────────────────────────────────────────────────────────

  @Post('budgets')
  @HttpCode(HttpStatus.CREATED)
  createBudget(@CurrentUser() user: User, @Body() dto: CreateBudgetDto) {
    return this.financeService.createBudget(user.id, dto);
  }

  @Get('budgets')
  getBudgets(@CurrentUser() user: User) {
    return this.financeService.getBudgets(user.id);
  }

  @Patch('budgets/:id')
  updateBudget(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.financeService.updateBudget(user.id, id, dto);
  }

  @Delete('budgets/:id')
  @HttpCode(HttpStatus.OK)
  deleteBudget(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.financeService.deleteBudget(user.id, id);
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  @Get('analytics/summary')
  getSpendingSummary(@CurrentUser() user: User) {
    return this.financeService.getSpendingSummary(user.id);
  }

  @Get('analytics/categories')
  getSpendingByCategories(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto) {
    return this.financeService.getSpendingByCategories(user.id, query);
  }

  // ─── Accounts ─────────────────────────────────────────────────────────────

  @Get('accounts')
  getAccounts(@CurrentUser() user: User) {
    return this.financeService.getAccounts(user.id);
  }
}
