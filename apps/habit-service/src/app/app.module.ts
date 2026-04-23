import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingModule } from '@klenzo/messaging';
import { Habit, HabitLog } from './entities/habit.entity';
import { HabitController } from './habit.controller';
import { HabitService } from './habit.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: 5432,
      username: 'klenzo',
      password: 'klenzo_password',
      database: 'klenzo_db',
      schema: 'habit',
      entities: [Habit, HabitLog],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Habit, HabitLog]),
    MessagingModule.forRoot({ servers: [process.env.NATS_SERVERS || 'nats://localhost:4222'] }),
  ],
  controllers: [HabitController],
  providers: [HabitService],
})
export class AppModule {}
