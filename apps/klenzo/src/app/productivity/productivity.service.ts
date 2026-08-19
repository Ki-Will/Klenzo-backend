import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus, NotificationType } from '@prisma/client';
import { CreateTaskDto, UpdateTaskDto, TaskStatus as DtoTaskStatus } from '../dto/task.dto';
import { NotificationService } from '../notification/notification.service';


@Injectable()
export class ProductivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  private mapTaskStatus(status: DtoTaskStatus): TaskStatus {
    const mapping: Record<DtoTaskStatus, TaskStatus> = {
      [DtoTaskStatus.TODO]: TaskStatus.TODO,
      [DtoTaskStatus.IN_PROGRESS]: TaskStatus.IN_PROGRESS,
      [DtoTaskStatus.DONE]: TaskStatus.DONE,
      [DtoTaskStatus.CANCELLED]: TaskStatus.CANCELLED,
    };
    return mapping[status];
  }

  async createTask(userId: string, dto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status ? this.mapTaskStatus(dto.status) : TaskStatus.TODO,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        priority: dto.priority,
        userId,
      },
    });
  }

  async getTasks(userId: string) {
    return this.prisma.task.findMany({
      where: { userId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getTask(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException();
    return task;
  }

  async updateTask(
    userId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ) {
    await this.getTask(userId, taskId);
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status ? this.mapTaskStatus(dto.status) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        priority: dto.priority,
      },
    });
  }

  async deleteTask(userId: string, taskId: string): Promise<{ message: string }> {
    const task = await this.getTask(userId, taskId);
    await this.prisma.task.delete({ where: { id: taskId } });
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
