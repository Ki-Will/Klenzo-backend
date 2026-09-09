import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';

@Module({
  controllers: [PayrollController],
})
export class PayrollModule {}
