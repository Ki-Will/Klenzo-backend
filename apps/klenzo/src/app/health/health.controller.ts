import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('healthz')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check() {
    return this.healthService.check();
  }

  @Get('live')
  live() {
    return { status: 'ok', service: 'klenzo' };
  }

  @Get('ready')
  async ready() {
    return this.healthService.check();
  }
}
