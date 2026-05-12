import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity({ schema: 'habit', name: 'habits' })
export class Habit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  /** 'daily' | 'weekly' */
  @Column()
  frequency: string;

  @Column({ default: 0 })
  currentStreak: number;

  @Column({ default: 0 })
  longestStreak: number;

  @Column({ type: 'date', nullable: true })
  lastCompletedDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => HabitLog, (log) => log.habit, { cascade: true })
  logs: HabitLog[];
}

@Entity({ schema: 'habit', name: 'habit_logs' })
export class HabitLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  habitId: number;

  @ManyToOne(() => Habit, (habit) => habit.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'habitId' })
  habit: Habit;

  @Column({ type: 'date' })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
