import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../entities/transaction.entity';
import { Group, GroupMember } from '../entities/group.entity';
import { Budget } from '../entities/budget.entity';
import { Account } from '../entities/account.entity';
import { User } from '../entities/user.entity';
import { Task } from '../entities/task.entity';
import { Habit, HabitLog } from '../entities/habit.entity';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { NotificationModule } from '../notification/notification.module';
import { InsightService } from '../insight/insight.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction, Group, GroupMember, Budget, Account, User,
      // InsightService needs these to run invalidateDashboard
      Task, Habit, HabitLog,
    ]),
    NotificationModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService, InsightService],
})
export class FinanceModule {}
