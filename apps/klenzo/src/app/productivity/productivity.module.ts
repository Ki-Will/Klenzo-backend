import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../entities/task.entity';
import { ProductivityController } from './productivity.controller';
import { ProductivityService } from './productivity.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [TypeOrmModule.forFeature([Task]), NotificationModule],
  controllers: [ProductivityController],
  providers: [ProductivityService],
})
export class ProductivityModule {}
