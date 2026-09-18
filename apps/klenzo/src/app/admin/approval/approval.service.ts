import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

/**
 * Approval Workflow Service
 *
 * Handles request → approval → execution flows for sensitive financial operations:
 * - Transaction reversals
 * - Wallet balance adjustments
 * - Refunds
 * - Provider disablement
 * - Limit changes
 * - Account restrictions
 *
 * Enforces separation of duties: requester cannot approve their own request.
 */
@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create an approval request for a sensitive operation.
   */
  async createRequest(params: {
    type: string;
    requestedById: string;
    targetType: string;
    targetId: string;
    payload: Record<string, unknown>;
    reason?: string;
    expiresAt?: Date;
  }) {
    const request = await this.prisma.approvalRequest.create({
      data: {
        type: params.type as any,
        requestedById: params.requestedById,
        targetType: params.targetType,
        targetId: params.targetId,
        payload: params.payload,
        reason: params.reason,
        expiresAt: params.expiresAt,
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await this.auditService.log({
      actorId: params.requestedById,
      actorRole: 'admin',
      action: 'APPROVAL_REQUEST_CREATED',
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: {
        approvalId: request.id,
        type: params.type,
        reason: params.reason,
      },
    });

    return request;
  }

  /**
   * Approve an approval request.
   * Enforces separation of duties: cannot approve your own request.
   */
  async approveRequest(
    requestId: string,
    approverId: string,
    note?: string,
  ) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: {
        requestedBy: { select: { id: true, name: true } },
      },
    });

    if (!request) throw new NotFoundException('Approval request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${request.status.toLowerCase()}`);
    }

    // Check expiration
    if (request.expiresAt && request.expiresAt < new Date()) {
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Approval request has expired');
    }

    // Enforce separation of duties
    if (request.requestedById === approverId) {
      await this.auditService.log({
        actorId: approverId,
        actorRole: 'admin',
        action: 'PRIVILEGE_ESCALATION_ATTEMPTED',
        targetType: 'approval',
        targetId: requestId,
        metadata: { reason: 'Self-approval attempt' },
        result: 'DENIED',
      });
      throw new BadRequestException('Cannot approve your own request (separation of duties)');
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedById: approverId,
        rejectionReason: note,
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      actorId: approverId,
      actorRole: 'admin',
      action: 'APPROVAL_REQUEST_APPROVED',
      targetType: request.targetType,
      targetId: request.targetId,
      metadata: {
        approvalId: requestId,
        type: request.type,
        requestedBy: request.requestedBy.name,
        note,
      },
    });

    return updated;
  }

  /**
   * Reject an approval request.
   */
  async rejectRequest(
    requestId: string,
    approverId: string,
    reason: string,
  ) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Approval request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${request.status.toLowerCase()}`);
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        approvedById: approverId,
        rejectionReason: reason,
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      actorId: approverId,
      actorRole: 'admin',
      action: 'APPROVAL_REQUEST_REJECTED',
      targetType: request.targetType,
      targetId: request.targetId,
      metadata: {
        approvalId: requestId,
        type: request.type,
        reason,
      },
    });

    return updated;
  }

  /**
   * Get pending approval requests.
   */
  async getPendingRequests(type?: string) {
    const where: Record<string, unknown> = { status: 'PENDING' };
    if (type) where.type = type;

    return this.prisma.approvalRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Get all approval requests for a user (requested or approved).
   */
  async getUserRequests(userId: string, limit = 50) {
    return this.prisma.approvalRequest.findMany({
      where: {
        OR: [{ requestedById: userId }, { approvedById: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
  }
}
