import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { NatsConnection, StringCodec, JetStreamClient } from 'nats';
import { NATS_CONNECTION } from './messaging.module';

@Injectable()
export class EventBusService implements OnModuleDestroy {
    private js: JetStreamClient;
    private sc = StringCodec();

    constructor(@Inject(NATS_CONNECTION) private readonly nc: NatsConnection) {
        this.js = this.nc.jetstream();
    }

    /**
     * Publish an event to JetStream
     */
    async publish<T>(subject: string, data: T): Promise<void> {
        const payload = this.sc.encode(JSON.stringify(data));
        await this.js.publish(subject, payload);
    }

    /**
     * Request/Reply pattern (Core NATS)
     */
    async request<TRequest, TResponse>(
        subject: string,
        data: TRequest,
        timeoutMs = 5000,
    ): Promise<TResponse> {
        const payload = this.sc.encode(JSON.stringify(data));
        const response = await this.nc.request(subject, payload, { timeout: timeoutMs });
        return JSON.parse(this.sc.decode(response.data)) as TResponse;
    }

    async onModuleDestroy() {
        await this.nc.drain();
        await this.nc.close();
    }
}
