import { Module } from '@nestjs/common';
import { HabitController } from './habit.controller';
import { HabitService } from './habit.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [HabitController],
  providers: [HabitService],
})
export class HabitModule {}
