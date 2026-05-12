import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { Transaction } from './transaction.entity';

@Entity({ schema: 'finance', name: 'groups' })
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => GroupMember, (member) => member.group, { cascade: true })
  members: GroupMember[];

  @OneToMany(() => Transaction, (transaction) => transaction.group)
  transactions: Transaction[];
}

@Entity({ schema: 'finance', name: 'group_members' })
export class GroupMember {
  @PrimaryGeneratedColumn()
  id: number;

  /** 0 means invited / not yet registered */
  @Column({ default: 0 })
  userId: number;

  @Column()
  email: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Group, (group) => group.members, { onDelete: 'CASCADE' })
  group: Group;

  @Column('uuid')
  groupId: string;
}
