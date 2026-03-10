import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'finance', name: 'budgets' })
export class Budget {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  category: string;

  @Column('decimal', { precision: 15, scale: 2 })
  limitAmount: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  spent: number;

  @Column({ default: 'monthly' })
  period: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
