import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { Group } from './group.entity';

@Entity({ schema: 'finance', name: 'transactions' })
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ nullable: true })
  groupId: number;

  @ManyToOne(() => Group, (group) => group.transactions)
  group: Group;

  @Column({ nullable: true })
  accountId: number;

  @Column('decimal', { precision: 15, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  category: string;

  @Column()
  transactionType: 'income' | 'expense';

  @Column()
  date: Date;

  @CreateDateColumn()
  createdAt: Date;
}
