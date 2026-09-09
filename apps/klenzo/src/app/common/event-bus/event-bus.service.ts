import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

export interface AppEvent {
  channel: string;
  payload: any;
  timestamp: string;
}

@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private publisher: Redis;
  private subscriber: Redis;

  onModuleInit() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = Number(process.env.REDIS_PORT) || 6379;

    this.publisher = new Redis({ host: redisHost, port: redisPort });
    this.subscriber = new Redis({ host: redisHost, port: redisPort });

    this.logger.log(`EventBus connected to Redis at ${redisHost}:${redisPort}`);
  }

  async publish(channel: string, payload: any): Promise<void> {
    const message = JSON.stringify({
      channel,
      payload,
      timestamp: new Date().toISOString(),
    });

    await this.publisher.publish(channel, message);
    this.logger.debug(`Event published to channel [${channel}]`);
  }

  subscribe(channel: string, callback: (payload: any) => void): void {
    this.subscriber.subscribe(channel, (err) => {
      if (err) this.logger.error(`Failed to subscribe to ${channel}`, err);
    });

    this.subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          const parsed: AppEvent = JSON.parse(message);
          callback(parsed.payload);
        } catch (e) {
          this.logger.error(`Failed to parse event on ${channel}`, e);
        }
      }
    });
  }

  onModuleDestroy() {
    this.publisher?.disconnect();
    this.subscriber?.disconnect();
  }
}
