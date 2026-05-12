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
  category: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  limitAmount: number;

  @IsIn(['monthly', 'weekly', 'yearly'])
  @IsOptional()
  period?: string;
}

export class UpdateBudgetDto {
  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  limitAmount?: number;

  @IsIn(['monthly', 'weekly', 'yearly'])
  @IsOptional()
  period?: string;
}

export class AnalyticsQueryDto {
  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;
}
