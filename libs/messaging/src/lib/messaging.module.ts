import { DynamicModule, Module, Global } from '@nestjs/common';
import { connect, NatsConnection } from 'nats';
import { EventBusService } from './event-bus.service';

export const NATS_CONNECTION = 'NATS_CONNECTION';

export interface MessagingModuleOptions {
  servers: string | string[];
}

@Global()
@Module({})
export class MessagingModule {
  static forRoot(options: MessagingModuleOptions): DynamicModule {
    const natsProvider = {
      provide: NATS_CONNECTION,
      useFactory: (options: MessagingModuleOptions) => {
        return connect({ servers: options.servers, maxReconnectAttempts: -1 });
      },
      inject: [MESSAGING_MODULE_OPTIONS],
    };

    return {
      module: MessagingModule,
      providers: [natsProvider, EventBusService],
      exports: [EventBusService, NATS_CONNECTION],
    };
  }
}
