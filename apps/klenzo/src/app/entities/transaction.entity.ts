import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Group } from './group.entity';

export enum TransactionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
}

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

@Entity({ schema: 'finance', name: 'transactions' })
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ nullable: true, type: 'uuid' })
  groupId: string | null;

  @ManyToOne(() => Group, (group) => group.transactions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Column({ nullable: true, type: 'int' })
  accountId: number | null;

  /**
   * For split transactions:
   * stores the parent expense transaction id.
   */
  @Column({ nullable: true, type: 'int' })
  parentTransactionId: number | null;

  /**
   * Transaction approval status.
   */
  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.APPROVED,
  })
  status: TransactionStatus;

  /**
   * Transaction type.
   */
  @Column({
    type: 'enum',
    enum: TransactionType,
    default: TransactionType.EXPENSE,
  })
  transactionType: TransactionType;

  /**
   * Monetary amount.
   * Stored as decimal in PostgreSQL,
   * converted to number in JavaScript.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => parseFloat(v),
    },
  })
  amount: number;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string | null;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  category: string | null;

  @Column({
    type: 'timestamptz',
  })
  date: Date;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;
}