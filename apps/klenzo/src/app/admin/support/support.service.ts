import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { Prisma, SupportCasePriority, SupportCaseStatus } from '@prisma/client';

/**
 * Support Case Service
 *
 * Admin-facing support ticketing: cases opened by users (or on their behalf)
 * are triaged, assigned, escalated and closed here. Every mutation is audit
 * logged like the rest of the admin module.
 */

const CASE_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
  messages: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.SupportCaseInclude;

export interface CreateSupportCaseDto {
  userId: string;
  subject: string;
  description: string;
  priority?: string;
}

export interface UpdateSupportCaseDto {
  status?: string;
  priority?: string;
  assignedTo?: string | null;
}

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * List support cases, optionally filtered by status
   * (lowercase, `all`, or the raw enum value).
   */
  async list(status?: string) {
    const where: Prisma.SupportCaseWhereInput = {};
    if (status && status.toLowerCase() !== 'all') {
      where.status = status.toUpperCase() as SupportCaseStatus;
    }

    return this.prisma.supportCase.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: CASE_INCLUDE,
    });
  }

  async getById(id: string) {
    const supportCase = await this.prisma.supportCase.findUnique({
      where: { id },
      include: CASE_INCLUDE,
    });
    if (!supportCase) throw new NotFoundException('Support case not found');
    return supportCase;
  }

  /**
   * Create a case on behalf of a user (admin-initiated support request).
   */
  async create(actorId: string, dto: CreateSupportCaseDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const supportCase = await this.prisma.supportCase.create({
      data: {
        userId: dto.userId,
        subject: dto.subject,
        description: dto.description,
        priority: (dto.priority?.toUpperCase() as SupportCasePriority) || 'MEDIUM',
      },
      include: CASE_INCLUDE,
    });

    await this.auditService.log({
      actorId,
      actorRole: 'admin',
      action: 'SUPPORT_CASE_CREATED',
      targetType: 'support_case',
      targetId: supportCase.id,
      metadata: { subject: supportCase.subject, userId: dto.userId },
    });

    return supportCase;
  }

  /**
   * Generic update: status, priority, assignment.
   */
  async update(actorId: string, id: string, dto: UpdateSupportCaseDto) {
    await this.getById(id);

    const data: Prisma.SupportCaseUpdateInput = {};
    if (dto.status) data.status = dto.status.toUpperCase() as SupportCaseStatus;
    if (dto.priority) data.priority = dto.priority.toUpperCase() as SupportCasePriority;
    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;

    const supportCase = await this.prisma.supportCase.update({
      where: { id },
      data,
      include: CASE_INCLUDE,
    });

    await this.auditService.log({
      actorId,
      actorRole: 'admin',
      action: 'SUPPORT_CASE_UPDATED',
      targetType: 'support_case',
      targetId: id,
      metadata: dto as Record<string, unknown>,
    });

    return supportCase;
  }

  async escalate(actorId: string, id: string) {
    await this.getById(id);
    const supportCase = await this.prisma.supportCase.update({
      where: { id },
      data: { status: 'ESCALATED' },
      include: CASE_INCLUDE,
    });

    await this.auditService.log({
      actorId,
      actorRole: 'admin',
      action: 'SUPPORT_CASE_ESCALATED',
      targetType: 'support_case',
      targetId: id,
      metadata: { subject: supportCase.subject },
    });

    return supportCase;
  }

  async close(actorId: string, id: string) {
    await this.getById(id);
    const supportCase = await this.prisma.supportCase.update({
      where: { id },
      data: { status: 'CLOSED' },
      include: CASE_INCLUDE,
    });

    await this.auditService.log({
      actorId,
      actorRole: 'admin',
      action: 'SUPPORT_CASE_CLOSED',
      targetType: 'support_case',
      targetId: id,
      metadata: { subject: supportCase.subject },
    });

    return supportCase;
  }

  /**
   * Append a message (admin note / reply) and touch the case so list
   * ordering reflects the latest activity.
   */
  async addMessage(
    actorId: string,
    actorName: string | null | undefined,
    id: string,
    body: string,
  ) {
    const existing = await this.getById(id);

    const message = await this.prisma.supportCaseMessage.create({
      data: {
        caseId: id,
        authorId: actorId,
        authorName: actorName || existing.user?.email || 'Admin',
        body,
      },
    });

    await this.prisma.supportCase.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    await this.auditService.log({
      actorId,
      actorRole: 'admin',
      action: 'SUPPORT_CASE_MESSAGE_ADDED',
      targetType: 'support_case',
      targetId: id,
      metadata: { messageId: message.id },
    });

    this.logger.log(`Support case ${id} received a message from ${message.authorName}`);

    return message;
  }
}
