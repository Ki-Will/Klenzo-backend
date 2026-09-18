import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles('admin', 'superadmin')
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  getLogs(
    @Query('action') action?: string,
    @Query('actorRole') actorRole?: string,
    @Query('result') result?: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditService.getRecentLogs({
      action,
      actorRole,
      result,
      targetType,
      targetId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('stats')
  @RequirePermissions('audit.read')
  getStats() {
    return this.auditService.getAuditStats();
  }

  @Get('verify-chain')
  @RequirePermissions('audit.read')
  @HttpCode(200)
  verifyChain() {
    return this.auditService.verifyChain();
  }

  @Get('verify/:id')
  @RequirePermissions('audit.read')
  verifyEntry(@Param('id') id: string) {
    return this.auditService.verifyEntry(id).then((valid) => ({ id, valid }));
  }

  @Get('actor/:actorId')
  @RequirePermissions('audit.read')
  getLogsByActor(
    @Param('actorId') actorId: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.getLogsByActor(
      actorId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('target/:targetType/:targetId')
  @RequirePermissions('audit.read')
  getLogsByTarget(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
  ) {
    return this.auditService.getLogsByTarget(targetType, targetId);
  }
}
