import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Habit, HabitLog } from './entities/habit.entity';
import { CreateHabitDto } from './dto/create-habit.dto';
import { EventBusService } from '@klenzo/messaging';

@Injectable()
export class HabitService {
  constructor(
    @InjectRepository(Habit)
    private readonly habitRepository: Repository<Habit>,
    @InjectRepository(HabitLog)
    private readonly habitLogRepository: Repository<HabitLog>,
    private readonly eventBus: EventBusService,
  ) {}

  async createHabit(userId: number, createHabitDto: CreateHabitDto): Promise<Habit> {
    const habit = this.habitRepository.create({
      ...createHabitDto,
      userId,
    });
    const savedHabit = await this.habitRepository.save(habit);
    this.eventBus.publish('habit.created', { habitId: savedHabit.id, userId });
    return savedHabit;
  }

  async getHabits(userId: number): Promise<Habit[]> {
    return this.habitRepository.find({ where: { userId } });
  }

  async completeHabit(userId: number, habitId: number): Promise<Habit> {
    const habit = await this.habitRepository.findOne({ where: { id: habitId, userId } });
    if (!habit) {
      throw new NotFoundException('Habit not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const log = this.habitLogRepository.create({
      habitId,
      completedAt: today,
    });
    await this.habitLogRepository.save(log);

    // Streak logic
    const lastDate = habit.lastCompletedDate ? new Date(habit.lastCompletedDate) : null;
    if (lastDate) {
        lastDate.setHours(0, 0, 0, 0);
        const diff = (today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24);
        if (diff === 1) {
            habit.currentStreak += 1;
        } else if (diff > 1) {
            habit.currentStreak = 1;
        }
    } else {
        habit.currentStreak = 1;
    }

    if (habit.currentStreak > habit.longestStreak) {
        habit.longestStreak = habit.currentStreak;
    }

    habit.lastCompletedDate = today;
    const updatedHabit = await this.habitRepository.save(habit);
    this.eventBus.publish('habit.completed', { habitId, userId, streak: updatedHabit.currentStreak });
    return updatedHabit;
  }

  async deleteHabit(userId: number, habitId: number): Promise<void> {
    const result = await this.habitRepository.delete({ id: habitId, userId });
    if (result.affected === 0) {
      throw new NotFoundException('Habit not found');
    }
    this.eventBus.publish('habit.deleted', { habitId, userId });
  }
}
