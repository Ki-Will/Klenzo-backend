import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { Group, GroupMember } from '../entities/group.entity';
import { CreateGroupDto } from '../dto/create-group.dto';
import { EventBusService } from '@klenzo/messaging';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(Group)
    private groupRepo: Repository<Group>,
    @InjectRepository(GroupMember)
    private groupMemberRepo: Repository<GroupMember>,
    private eventBus: EventBusService,
  ) {}

  async createTransaction(userId: number, data: { amount: number; description?: string; category?: string; transactionType: 'income' | 'expense'; date: string; groupId?: number }) {
    const transaction = this.transactionRepo.create({
      userId,
      ...data,
      date: new Date(data.date),
    });
    const saved = await this.transactionRepo.save(transaction);
    this.eventBus.publish('transaction.created', { transactionId: saved.id, userId, amount: saved.amount, category: saved.category, groupId: saved.groupId });
    return saved;
  }

  async getTransactions(userId: number) {
    return this.transactionRepo.find({ where: { userId }, order: { date: 'DESC' } });
  }

  // Group Management
  async createGroup(userId: number, createGroupDto: CreateGroupDto) {
    const group = this.groupRepo.create({
      name: createGroupDto.name,
      createdBy: userId,
    });

    // In a real app, we'd look up existing users or invite them
    const members = await Promise.all(
      createGroupDto.memberEmails.map(async (email) => {
        let member = await this.groupMemberRepo.findOne({ where: { email } });
        if (!member) {
          member = this.groupMemberRepo.create({ email, userId: 0 }); // 0 means invited/not yet registered
          await this.groupMemberRepo.save(member);
        }
        return member;
      })
    );

    group.members = members;
    const savedGroup = await this.groupRepo.save(group);
    this.eventBus.publish('group.created', { groupId: savedGroup.id, userId });
    return savedGroup;
  }

  async getGroups(userId: number) {
    // This is a simplified query; in production, you'd join across members
    return this.groupRepo.find({
      where: { createdBy: userId },
      relations: ['members']
    });
  }

  async getGroupDetail(groupId: number) {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['members', 'transactions']
    });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  // Analytics
  async getSpendingSummary(userId: number) {
    const transactions = await this.transactionRepo.find({ where: { userId, transactionType: 'expense' } });
    const total = transactions.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const byCategory = transactions.reduce((acc, curr) => {
      acc[curr.category || 'other'] = (acc[curr.category || 'other'] || 0) + Number(curr.amount);
      return acc;
    }, {} as Record<string, number>);

    return { total, byCategory };
  }
}
