import { Injectable, OnModuleInit } from '@nestjs/common';
import { register, Counter, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private requestCount: Counter<string>;

  onModuleInit() {
    // collect default metrics like CPU, memory, GC, etc.
    collectDefaultMetrics();
    this.requestCount = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
    });
  }

  incrementRequest(method: string, route: string, status: number) {
    this.requestCount.inc({ method, route, status: status.toString() }, 1);
  }

  async getPromMetrics(): Promise<string> {
    return await register.metrics();
  }

  // custom JSON metric example – total users
  async getCustomMetrics(): Promise<Record<string, any>> {
    // placeholder, real implementation would query DB via repository injections.
    return {
      timestamp: new Date().toISOString(),
      // these values are filled by controller using injected services.
    };
  }
}
