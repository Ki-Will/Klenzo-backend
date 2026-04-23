import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingModule } from '@klenzo/messaging';
import { Transaction } from './entities/transaction.entity';
import { Account } from './entities/account.entity';
import { Budget } from './entities/budget.entity';
import { Group, GroupMember } from './entities/group.entity';
import { FinanceController } from './finance/finance.controller';
import { FinanceService } from './finance/finance.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: 5432,
      username: 'klenzo',
      password: 'klenzo_password',
      database: 'klenzo_db',
      schema: 'finance',
      entities: [Transaction, Account, Budget, Group, GroupMember],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Transaction, Account, Budget, Group, GroupMember]),
    MessagingModule.forRoot({ servers: [process.env.NATS_SERVERS || 'nats://localhost:4222'] }),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class AppModule {}
