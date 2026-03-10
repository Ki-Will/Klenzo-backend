import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { EventBusService } from '@klenzo/messaging';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    private eventBus: EventBusService,
  ) {}

  async createTransaction(userId: number, data: { amount: number; description?: string; category?: string; transactionType: 'income' | 'expense'; date: string }) {
    const transaction = this.transactionRepo.create({
      userId,
      ...data,
      date: new Date(data.date),
    });
    const saved = await this.transactionRepo.save(transaction);
    this.eventBus.publish('transaction.created', { transactionId: saved.id, userId, amount: saved.amount, category: saved.category });
    return saved;
  }

  async getTransactions(userId: number) {
    return this.transactionRepo.find({ where: { userId } });
  }
}
