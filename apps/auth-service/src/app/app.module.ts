import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MessagingModule } from '@klenzo/messaging';
import { AuthController } from './app.controller';
import { AuthService } from './auth.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    MessagingModule.forRoot({
      servers: process.env.NATS_SERVERS || 'nats://localhost:4222',
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService],
})
export class AppModule { }
