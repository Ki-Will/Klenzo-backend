import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'finance', name: 'budgets' })
export class Budget {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ default: 'General Budget' })
  name: string;

  @Column({ nullable: true })
  category: string;

  /** 'expense' | 'income' */
  @Column({ default: 'expense' })
  type: string;

  @Column('decimal', { precision: 15, scale: 2 })
  limitAmount: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  spent: number;

  /** 'monthly' | 'quarterly' | 'yearly' | 'custom' */
  @Column({ default: 'monthly' })
  period: string;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ type: 'timestamptz', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
