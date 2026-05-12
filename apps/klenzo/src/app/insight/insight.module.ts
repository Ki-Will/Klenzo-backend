import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../entities/task.entity';
import { Habit, HabitLog } from '../entities/habit.entity';
import { Transaction } from '../entities/transaction.entity';
import { InsightController } from './insight.controller';
import { InsightService } from './insight.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Habit, HabitLog, Transaction])],
  controllers: [InsightController],
  providers: [InsightService],
})
export class InsightModule {}
