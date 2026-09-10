import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payroll')
@UseGuards(JwtAuthGuard)
export class PayrollController {
  @Get()
  async getPayrollSummary(@Req() req: any) {
    return {
      activeEmployees: 12,
      lastPayrollTotal: 24500.00,
      nextPayrollDate: new Date(Date.now() + 864000000).toISOString(),
      status: 'READY',
    };
  }

  @Get('employees')
  async getEmployees(@Req() req: any) {
    return {
      employees: [
        { id: 'emp-1', name: 'John Doe', role: 'Software Engineer', salary: 4500.00, status: 'ACTIVE' },
        { id: 'emp-2', name: 'Jane Smith', role: 'Product Manager', salary: 5200.00, status: 'ACTIVE' },
      ],
    };
  }

  @Get('runs')
  async getPayrollRuns(@Req() req: any) {
    return {
      runs: [
        { id: 'run-101', period: 'August 2026', totalAmount: 24500.00, status: 'COMPLETED', processedAt: new Date(Date.now() - 1000000000).toISOString() },
      ],
    };
  }

  @Post('runs')
  async processPayrollRun(@Req() req: any, @Body() dto: { period: string; totalAmount: number }) {
    return {
      id: 'run-' + Date.now(),
      period: dto.period,
      totalAmount: dto.totalAmount,
      status: 'PROCESSING',
      initiatedBy: req.user.id,
      createdAt: new Date().toISOString(),
    };
  }
}
