import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Habit, HabitLog } from '../entities/habit.entity';
import { HabitController } from './habit.controller';
import { HabitService } from './habit.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Habit, HabitLog]),
    NotificationModule,
  ],
  controllers: [HabitController],
  providers: [HabitService],
})
export class HabitModule {}
