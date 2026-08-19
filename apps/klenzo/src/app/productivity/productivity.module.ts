import { Module } from '@nestjs/common';
import { ProductivityController } from './productivity.controller';
import { ProductivityService } from './productivity.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [ProductivityController],
  providers: [ProductivityService],
})
export class ProductivityModule {}
