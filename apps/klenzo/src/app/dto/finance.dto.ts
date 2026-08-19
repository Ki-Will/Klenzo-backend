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

  @IsIn(['INCOME', 'EXPENSE'])
  transactionType: 'INCOME' | 'EXPENSE';

  @IsDateString()
  date: string;

  /** Links this transaction to a group expense */
  @IsString()
  @IsOptional()
  groupId?: string;

  @IsString()
  @IsOptional()
  accountId?: string;

  /**
   * Approval state for split transactions.
   * Creator's own transaction is always 'approved'.
   * Split copies for other members start as 'pending'.
   * Defaults to 'approved' if omitted.
   */
  @IsIn(['PENDING', 'APPROVED'])
  @IsOptional()
  status?: 'PENDING' | 'APPROVED';

  /**
   * For split transactions: the id of the parent group expense.
   * null / omitted for the original transaction.
   */
  @IsString()
  @IsOptional()
  parentTransactionId?: string;

  @IsString()
  @IsOptional()
  budgetId?: string;
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

  @IsIn(['INCOME', 'EXPENSE'])
  @IsOptional()
  transactionType?: 'INCOME' | 'EXPENSE';

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  groupId?: string;

  @IsString()
  @IsOptional()
  accountId?: string;

  @IsIn(['PENDING', 'APPROVED'])
  @IsOptional()
  status?: 'PENDING' | 'APPROVED';

  @IsString()
  @IsOptional()
  parentTransactionId?: string;

  @IsString()
  @IsOptional()
  budgetId?: string;
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

  @IsIn(['MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM'])
  @IsOptional()
  period?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';

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

  @IsIn(['MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM'])
  @IsOptional()
  period?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';

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
