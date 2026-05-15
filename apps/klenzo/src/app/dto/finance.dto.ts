import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEmail,
  IsNumber,
  IsPositive,
  IsIn,
  IsDateString,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../entities/transaction.entity';

export class CreateTransactionDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsIn([TransactionType.INCOME, TransactionType.EXPENSE])
  transactionType: TransactionType;

  @IsDateString()
  date: string;

  /** Links this transaction to a group expense */
  @IsString()
  @IsOptional()
  groupId?: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  accountId?: number;

  /**
   * Approval state for split transactions.
   * Creator's own transaction is always 'approved'.
   * Split copies for other members start as 'pending'.
   * Defaults to 'approved' if omitted.
   */
  @IsIn(['pending', 'approved'])
  @IsOptional()
  status?: 'pending' | 'approved';

  /**
   * For split transactions: the id of the parent group expense.
   * null / omitted for the original transaction.
   */
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  parentTransactionId?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  budgetId?: number;
}

export class UpdateTransactionDto {
  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsIn([TransactionType.INCOME, TransactionType.EXPENSE])
  @IsOptional()
  transactionType?: TransactionType;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  groupId?: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  accountId?: number;

  @IsIn(['pending', 'approved'])
  @IsOptional()
  status?: 'pending' | 'approved';

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  parentTransactionId?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  budgetId?: number;
}

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Optional — create an empty group and add members later via
   * POST /finance/groups/:id/members
   */
  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  memberEmails?: string[];
}

export class CreateBudgetDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  limitAmount: number;

  @IsIn(['monthly', 'quarterly', 'yearly', 'custom'])
  @IsOptional()
  period?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class UpdateBudgetDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  limitAmount?: number;

  @IsIn(['monthly', 'quarterly', 'yearly', 'custom'])
  @IsOptional()
  period?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class AnalyticsQueryDto {
  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;
}
