import { Module } from '@nestjs/common';
import { MessagingModule } from '@klenzo/messaging';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    MessagingModule.forRoot({ servers: [process.env.NATS_SERVERS || 'nats://localhost:4222'] }),
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class AppModule {}
