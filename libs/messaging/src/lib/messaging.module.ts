import { DynamicModule, Module, Global } from '@nestjs/common';
import { connect, NatsConnection } from 'nats';
import { EventBusService } from './event-bus.service';

export const NATS_CONNECTION = 'NATS_CONNECTION';
export const MESSAGING_MODULE_OPTIONS = 'MESSAGING_MODULE_OPTIONS';

export interface MessagingModuleOptions {
  servers: string | string[];
}

@Module({})
export class MessagingModule {
  static forRoot(options: MessagingModuleOptions): DynamicModule {
    const natsProvider = {
      provide: NATS_CONNECTION,
      useFactory: async (options: MessagingModuleOptions) => {
        return connect({ servers: options.servers, maxReconnectAttempts: -1 });
      },
      inject: [MESSAGING_MODULE_OPTIONS],
    };

    return {
      module: MessagingModule,
      providers: [
        {
          provide: MESSAGING_MODULE_OPTIONS,
          useValue: options,
        },
        natsProvider,
        {
          provide: EventBusService,
          useFactory: (ncPromise: Promise<NatsConnection>) => {
            return new EventBusService(ncPromise);
          },
          inject: [NATS_CONNECTION],
        },
      ],
      exports: [EventBusService, NATS_CONNECTION],
    };
  }

  static forFeature(): DynamicModule {
    return {
      module: MessagingModule,
      providers: [EventBusService],
      exports: [EventBusService],
    };
  }
}
