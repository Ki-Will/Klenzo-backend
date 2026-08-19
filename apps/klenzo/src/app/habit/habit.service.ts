import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HabitFrequency, NotificationType } from '@prisma/client';
import { CreateHabitDto, UpdateHabitDto } from '../dto/habit.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class HabitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async createHabit(userId: string, dto: CreateHabitDto) {
    return this.prisma.habit.create({
      data: { ...dto, userId, frequency: dto.frequency as HabitFrequency },
    });
  }

  async getHabits(userId: string) {
    return this.prisma.habit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getHabit(userId: string, habitId: string) {
    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
      include: { logs: true },
    });
    if (!habit) throw new NotFoundException('Habit not found');
    if (habit.userId !== userId) throw new ForbiddenException();
    return habit;
  }

  async updateHabit(
    userId: string,
    habitId: string,
    dto: UpdateHabitDto,
  ) {
    const habit = await this.getHabit(userId, habitId);
    return this.prisma.habit.update({
      where: { id: habitId },
      data: {
        ...dto,
        frequency: dto.frequency ? (dto.frequency as HabitFrequency) : habit.frequency,
      },
    });
  }

  async completeHabit(userId: string, habitId: string) {
    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId, userId },
    });
    if (!habit) throw new NotFoundException('Habit not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Prevent double-completion on the same day
    const alreadyDone = await this.prisma.habitLog.findFirst({
      where: { habitId, completedAt: today },
    });
    if (alreadyDone) {
      throw new BadRequestException('Habit already completed today');
    }

    await this.prisma.habitLog.create({
      data: { habitId, completedAt: today },
    });

    // Streak calculation
    const lastDate = habit.lastCompletedDate
      ? new Date(habit.lastCompletedDate)
      : null;

    let newStreak = habit.currentStreak;

    if (lastDate) {
      lastDate.setHours(0, 0, 0, 0);
      const diffDays =
        (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

      if (habit.frequency === HabitFrequency.DAILY) {
        if (diffDays === 1) {
          newStreak += 1;
        } else if (diffDays > 1) {
          newStreak = 1; // streak broken
        }
        // diffDays === 0 means same day — prevented above
      } else if (habit.frequency === HabitFrequency.WEEKLY) {
        if (diffDays <= 7) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
      }
    } else {
      newStreak = 1;
    }

    const newLongestStreak = Math.max(newStreak, habit.longestStreak);

    const updated = await this.prisma.habit.update({
      where: { id: habitId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastCompletedDate: today,
      },
    });

    // Milestone notifications
    const milestones = [7, 14, 30, 60, 100, 365];
    if (milestones.includes(updated.currentStreak)) {
      this.notificationService
        .createNotification({
          userId,
          title: `🔥 ${updated.currentStreak}-day streak!`,
          message: `You've completed "${updated.name}" for ${updated.currentStreak} days in a row. Keep it up!`,
          type: NotificationType.SUCCESS,
        })
        .catch(() => null);
    }

    return updated;
  }

  async deleteHabit(userId: string, habitId: string): Promise<{ message: string }> {
    await this.getHabit(userId, habitId);
    await this.prisma.habit.delete({ where: { id: habitId } });
    return { message: 'Habit deleted' };
  }

  async getHabitStats(userId: string, habitId: string) {
    const habit = await this.getHabit(userId, habitId);
    const totalCompletions = await this.prisma.habitLog.count({
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
