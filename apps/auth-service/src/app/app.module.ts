import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingModule } from '@klenzo/messaging';
import { User } from './entities/user.entity';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: 5432,
      username: 'klenzo',
      password: 'klenzo_password',
      database: 'klenzo_db',
      schema: 'auth',
      entities: [User],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([User]),
    MessagingModule.forRoot({ servers: [process.env.NATS_SERVERS || 'nats://localhost:4222'] }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AppModule {}
