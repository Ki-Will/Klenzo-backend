import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Habit, HabitLog } from '../entities/habit.entity';
import { CreateHabitDto, UpdateHabitDto } from '../dto/habit.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';

@Injectable()
export class HabitService {
  constructor(
    @InjectRepository(Habit)
    private readonly habitRepository: Repository<Habit>,
    @InjectRepository(HabitLog)
    private readonly habitLogRepository: Repository<HabitLog>,
    private readonly notificationService: NotificationService,
  ) {}

  async createHabit(userId: number, dto: CreateHabitDto): Promise<Habit> {
    const habit = this.habitRepository.create({ ...dto, userId });
    return this.habitRepository.save(habit);
  }

  async getHabits(userId: number): Promise<Habit[]> {
    return this.habitRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getHabit(userId: number, habitId: number): Promise<Habit> {
    const habit = await this.habitRepository.findOne({
      where: { id: habitId },
      relations: ['logs'],
    });
    if (!habit) throw new NotFoundException('Habit not found');
    if (habit.userId !== userId) throw new ForbiddenException();
    return habit;
  }

  async updateHabit(
    userId: number,
    habitId: number,
    dto: UpdateHabitDto,
  ): Promise<Habit> {
    const habit = await this.getHabit(userId, habitId);
    Object.assign(habit, dto);
    return this.habitRepository.save(habit);
  }

  async completeHabit(userId: number, habitId: number): Promise<Habit> {
    const habit = await this.habitRepository.findOne({
      where: { id: habitId, userId },
    });
    if (!habit) throw new NotFoundException('Habit not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Prevent double-completion on the same day
    const alreadyDone = await this.habitLogRepository.findOne({
      where: { habitId, completedAt: today },
    });
    if (alreadyDone) {
      throw new BadRequestException('Habit already completed today');
    }

    const log = this.habitLogRepository.create({ habitId, completedAt: today });
    await this.habitLogRepository.save(log);

    // Streak calculation
    const lastDate = habit.lastCompletedDate
      ? new Date(habit.lastCompletedDate)
      : null;

    if (lastDate) {
      lastDate.setHours(0, 0, 0, 0);
      const diffDays =
        (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

      if (habit.frequency === 'daily') {
        if (diffDays === 1) {
          habit.currentStreak += 1;
        } else if (diffDays > 1) {
          habit.currentStreak = 1; // streak broken
        }
        // diffDays === 0 means same day — prevented above
      } else if (habit.frequency === 'weekly') {
        if (diffDays <= 7) {
          habit.currentStreak += 1;
        } else {
          habit.currentStreak = 1;
        }
      }
    } else {
      habit.currentStreak = 1;
    }

    if (habit.currentStreak > habit.longestStreak) {
      habit.longestStreak = habit.currentStreak;
    }

    habit.lastCompletedDate = today;
    const updated = await this.habitRepository.save(habit);

    // Milestone notifications
    const milestones = [7, 14, 30, 60, 100, 365];
    if (milestones.includes(updated.currentStreak)) {
      this.notificationService
        .createNotification({
          userId,
          title: `🔥 ${updated.currentStreak}-day streak!`,
          message: `You\''ve completed "${updated.name}" for ${updated.currentStreak} days in a row. Keep it up!`,
          type: NotificationType.SUCCESS,
        })
        .catch(() => null);
    }

    return updated;
  }

  async deleteHabit(userId: number, habitId: number): Promise<{ message: string }> {
    const habit = await this.getHabit(userId, habitId);
    await this.habitRepository.remove(habit);
    return { message: 'Habit deleted' };
  }

  async getHabitStats(userId: number, habitId: number) {
    const habit = await this.getHabit(userId, habitId);
    const totalCompletions = await this.habitLogRepository.count({
      where: { habitId },
    });

    return {
      id: habit.id,
      name: habit.name,
      frequency: habit.frequency,
      currentStreak: habit.currentStreak,
      longestStreak: habit.longestStreak,
      totalCompletions,
      lastCompletedDate: habit.lastCompletedDate,
      createdAt: habit.createdAt,
    };
  }
}
