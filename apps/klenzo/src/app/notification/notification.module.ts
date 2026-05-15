import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Notification } from '../entities/notification.entity';
import { NotificationController, BannerController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';

import { User } from '../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User]),
    // JwtModule needed by NotificationGateway to verify WS tokens
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'KlenzoSecret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [NotificationController, BannerController],
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}
