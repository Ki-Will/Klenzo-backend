import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductivityService } from './productivity.service';
import { CreateTaskDto } from './dto/create-task.dto';

@Controller()
export class ProductivityController {
  constructor(private readonly productivityService: ProductivityService) {}

  @MessagePattern('productivity.task.create')
  async createTask(@Payload() data: { userId: number; dto: CreateTaskDto }) {
    return this.productivityService.createTask(data.userId, data.dto);
  }

  @MessagePattern('productivity.task.findAll')
  async getTasks(@Payload() data: { userId: number }) {
    return this.productivityService.getTasks(data.userId);
  }

  @MessagePattern('productivity.task.update')
  async updateTask(@Payload() data: { userId: number; taskId: number; dto: Partial<CreateTaskDto> }) {
    return this.productivityService.updateTask(data.userId, data.taskId, data.dto);
  }

  @MessagePattern('productivity.task.delete')
  async deleteTask(@Payload() data: { userId: number; taskId: number }) {
    await this.productivityService.deleteTask(data.userId, data.taskId);
    return { success: true };
  }
}
