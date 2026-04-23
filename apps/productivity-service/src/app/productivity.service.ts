import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { EventBusService } from '@klenzo/messaging';

@Injectable()
export class ProductivityService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly eventBus: EventBusService,
  ) {}

  async createTask(userId: number, createTaskDto: CreateTaskDto): Promise<Task> {
    const task = this.taskRepository.create({
      ...createTaskDto,
      userId,
    });
    const savedTask = await this.taskRepository.save(task);
    this.eventBus.publish('productivity.task.created', { taskId: savedTask.id, userId });
    return savedTask;
  }

  async getTasks(userId: number): Promise<Task[]> {
    return this.taskRepository.find({ where: { userId }, order: { priority: 'DESC', createdAt: 'DESC' } });
  }

  async updateTask(userId: number, taskId: number, updateTaskDto: Partial<CreateTaskDto>): Promise<Task> {
    const task = await this.taskRepository.findOne({ where: { id: taskId, userId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    Object.assign(task, updateTaskDto);
    const updatedTask = await this.taskRepository.save(task);
    this.eventBus.publish('productivity.task.updated', { taskId: updatedTask.id, userId });
    return updatedTask;
  }

  async deleteTask(userId: number, taskId: number): Promise<void> {
    const result = await this.taskRepository.delete({ id: taskId, userId });
    if (result.affected === 0) {
      throw new NotFoundException('Task not found');
    }
    this.eventBus.publish('productivity.task.deleted', { taskId, userId });
  }
}
