import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { NatsConnection, StringCodec, JetStreamClient } from 'nats';
import { NATS_CONNECTION } from './messaging.module';

@Injectable()
export class EventBusService implements OnModuleDestroy {
    private nc: NatsConnection | null = null;

    constructor(
        @Inject(NATS_CONNECTION) private readonly ncPromise: Promise<NatsConnection>
    ) {}

    private async getNc(): Promise<NatsConnection> {
        if (!this.nc) {
            this.nc = await this.ncPromise;
        }
        return this.nc;
    }

    /**
     * Publish an event to JetStream
     */
    async publish<T>(subject: string, data: T): Promise<void> {
        const nc = await this.getNc();
        const js = nc.jetstream();
        const sc = StringCodec();
        const payload = sc.encode(JSON.stringify(data));
        await js.publish(subject, payload);
    }

    /**
     * Request/Reply pattern (Core NATS)
     */
    async request<TRequest, TResponse>(
        subject: string,
        data: TRequest,
        timeoutMs = 5000,
    ): Promise<TResponse> {
        const nc = await this.getNc();
        const sc = StringCodec();
        const payload = sc.encode(JSON.stringify(data));
        const response = await nc.request(subject, payload, { timeout: timeoutMs });
        return JSON.parse(sc.decode(response.data)) as TResponse;
    }

    async onModuleDestroy() {
        if (this.nc) {
            await this.nc.drain();
            await this.nc.close();
        }
    }
}
