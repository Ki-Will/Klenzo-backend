import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * Exposes both Prometheus text format and a JSON API for custom metrics.
 */
@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async getProm(@Res() res: Response) {
    const metrics = await this.metricsService.getPromMetrics();
    res.send(metrics);
  }

  @Get('api/admin/metrics')
  async getJson(@Res() res: Response) {
    const data = await this.metricsService.getCustomMetrics();
    res.json(data);
  }
}
