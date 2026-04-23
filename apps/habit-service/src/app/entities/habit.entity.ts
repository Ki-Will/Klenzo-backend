import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

@Entity({ schema: 'habit', name: 'habits' })
export class Habit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  frequency: string; // e.g., 'daily', 'weekly'

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

  @OneToMany(() => HabitLog, (log) => log.habit)
  logs: HabitLog[];
}

@Entity({ schema: 'habit', name: 'habit_logs' })
export class HabitLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  habitId: number;

  @Column({ type: 'date' })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
