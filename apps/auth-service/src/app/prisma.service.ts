import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
    constructor() {
        super({
            datasourceUrl: 'postgresql://klenzo:klenzo_password@localhost:5432/auth_db?schema=public',
        });
    }
    async onModuleInit() {
        await this.$connect();
    }
}
