import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingModule } from '@klenzo/messaging';
import { Task } from './entities/task.entity';
import { ProductivityController } from './productivity.controller';
import { ProductivityService } from './productivity.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: 5432,
      username: 'klenzo',
      password: 'klenzo_password',
      database: 'klenzo_db',
      schema: 'productivity',
      entities: [Task],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Task]),
    MessagingModule.forRoot({ servers: [process.env.NATS_SERVERS || 'nats://localhost:4222'] }),
  ],
  controllers: [ProductivityController],
  providers: [ProductivityService],
})
export class AppModule {}
