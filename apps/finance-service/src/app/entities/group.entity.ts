import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { Transaction } from './transaction.entity';

@Entity({ schema: 'finance', name: 'groups' })
export class Group {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToMany(() => GroupMember)
  @JoinTable({
    name: 'group_members_mapping',
    joinColumn: { name: 'groupId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'memberId', referencedColumnName: 'id' }
  })
  members: GroupMember[];

  @OneToMany(() => Transaction, (transaction) => transaction.group)
  transactions: Transaction[];
}

@Entity({ schema: 'finance', name: 'group_members' })
export class GroupMember {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  email: string;

  @CreateDateColumn()
  createdAt: Date;
}
