import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { HabitService } from './habit.service';
import { CreateHabitDto } from './dto/create-habit.dto';

@Controller()
export class HabitController {
  constructor(private readonly habitService: HabitService) {}

  @MessagePattern('habit.create')
  async createHabit(@Payload() data: { userId: number; dto: CreateHabitDto }) {
    return this.habitService.createHabit(data.userId, data.dto);
  }

  @MessagePattern('habit.findAll')
  async getHabits(@Payload() data: { userId: number }) {
    return this.habitService.getHabits(data.userId);
  }

  @MessagePattern('habit.complete')
  async completeHabit(@Payload() data: { userId: number; habitId: number }) {
    return this.habitService.completeHabit(data.userId, data.habitId);
  }

  @MessagePattern('habit.delete')
  async deleteHabit(@Payload() data: { userId: number; habitId: number }) {
    await this.habitService.deleteHabit(data.userId, data.habitId);
    return { success: true };
  }
}
