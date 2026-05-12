import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { CreateTaskDto, UpdateTaskDto } from '../dto/task.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';


@Injectable()
export class ProductivityService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly notificationService: NotificationService,
  ) {}

  async createTask(userId: number, dto: CreateTaskDto): Promise<Task> {
    const task = this.taskRepository.create({
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      userId,
    });
    return this.taskRepository.save(task);
  }

  async getTasks(userId: number): Promise<Task[]> {
    return this.taskRepository.find({
      where: { userId },
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async getTask(userId: number, taskId: number): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException();
    return task;
  }

  async updateTask(
    userId: number,
    taskId: number,
    dto: UpdateTaskDto,
  ): Promise<Task> {
    const task = await this.getTask(userId, taskId);
    Object.assign(task, {
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : task.dueDate,
    });
    return this.taskRepository.save(task);
  }

  async deleteTask(userId: number, taskId: number): Promise<{ message: string }> {
    const task = await this.getTask(userId, taskId);
    await this.taskRepository.remove(task);
    this.notificationService
      .createNotification({
        userId,
        title: 'Task Deleted',
        message: `Your task "${task.title}" has been deleted.`,
        type: NotificationType.INFO,
      })
      .catch(() => null);
    return { message: 'Task deleted' };
  }
}
