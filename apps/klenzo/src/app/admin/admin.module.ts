import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    AuthModule,
    NotificationModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
