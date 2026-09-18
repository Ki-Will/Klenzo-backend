import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles('admin', 'superadmin')
@Controller('admin/approvals')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  @RequirePermissions('audit.read')
  getPendingRequests(@Query('type') type?: string) {
    return this.approvalService.getPendingRequests(type);
  }

  @Get('my')
  getMyRequests(@CurrentUser() user: UserPayload) {
    return this.approvalService.getUserRequests(user.id);
  }

  @Post(':id/approve')
  @RequirePermissions('transactions.reverse_approve')
  @HttpCode(HttpStatus.OK)
  approveRequest(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: { note?: string },
  ) {
    return this.approvalService.approveRequest(id, user.id, dto.note);
  }

  @Post(':id/reject')
  @RequirePermissions('transactions.reverse_approve')
  @HttpCode(HttpStatus.OK)
  rejectRequest(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: { reason: string },
  ) {
    return this.approvalService.rejectRequest(id, user.id, dto.reason);
  }
}
