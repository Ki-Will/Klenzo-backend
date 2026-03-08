import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { EventBusService } from '@klenzo/messaging';
import { NatsSubjects, UserCreatedEventPayload } from '@klenzo/contracts';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private eventBus: EventBusService,
    ) { }

    async register(data: any) {
        const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
        if (existing) {
            throw new ConflictException('Email already in use');
        }

        const hashedPassword = await bcrypt.hash(data.password, 10);
        const user = await this.prisma.user.create({
            data: {
                email: data.email,
                password: hashedPassword,
            },
        });

        // Fire & Forget Domain Event
        const eventPayload: UserCreatedEventPayload = {
            userId: user.id,
            email: user.email,
            createdAt: user.createdAt.toISOString(),
        };
        await this.eventBus.publish(NatsSubjects.USER_CREATED, eventPayload);

        return { message: 'User registered successfully', userId: user.id };
    }

    async login(data: any) {
        const user = await this.prisma.user.findUnique({ where: { email: data.email } });
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isMatch = await bcrypt.compare(data.password, user.password);
        if (!isMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload = { sub: user.id, email: user.email };
        const token = this.jwtService.sign(payload);

        return { access_token: token };
    }

    async validateToken(token: string) {
        try {
            const decoded = this.jwtService.verify(token);
            return { isValid: true, userId: decoded.sub, email: decoded.email };
        } catch (e) {
            return { isValid: false };
        }
    }
}
