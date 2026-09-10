import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../auth/jwt.strategy';
import { FinanceEventService } from './finance-event.service';

@ApiTags('Audit')
@ApiBearerAuth('access-token')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly financeEventService: FinanceEventService) {}

  @Get('finance/events')
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary: 'Get recent finance events',
    description:
      'Retrieve recent finance events from the database trigger audit trail. Admin only.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'table',
    required: false,
    type: String,
    enum: ['transactions', 'wallets', 'transfers', 'budgets', 'payroll_runs', 'payroll_employees'],
  })
  async getRecentEvents(
    @Query('limit') limit?: string,
    @Query('table') table?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.financeEventService.getRecentEvents(parsedLimit, table);
  }

  @Get('finance/events/user/:userId')
  @ApiOperation({
    summary: 'Get finance events for a user',
    description:
      'Retrieve finance events for a specific user. Users can only see their own events.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUserEvents(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @CurrentUser() user: UserPayload,
  ) {
    // Users can only see their own events, admins can see any user's events
    if (user.id !== userId && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return { error: 'Unauthorized to view this user\'s events' };
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    return this.financeEventService.getUserFinanceEvents(userId, parsedLimit);
  }

  @Get('finance/events/record/:tableName/:recordId')
  @ApiOperation({
    summary: 'Get audit trail for a specific record',
    description:
      'Retrieve the complete audit trail for a specific finance record.',
  })
  async getRecordAuditTrail(
    @Param('tableName') tableName: string,
    @Param('recordId') recordId: string,
  ) {
    // Validate table name to prevent SQL injection
    const allowedTables = [
      'transactions',
      'wallets',
      'transfers',
      'budgets',
      'payroll_runs',
      'payroll_employees',
    ];

    if (!allowedTables.includes(tableName)) {
      return { error: 'Invalid table name' };
    }

    return this.financeEventService.getRecordAuditTrail(tableName, recordId);
  }

  @Get('finance/events/stats')
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary: 'Get finance event statistics',
    description:
      'Get aggregated event statistics for a given time range. Admin only.',
  })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getEventStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { error: 'Invalid date format' };
    }

    return this.financeEventService.getEventStats(start, end);
  }
}
