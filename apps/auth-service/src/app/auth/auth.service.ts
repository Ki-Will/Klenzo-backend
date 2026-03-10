import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { EventBusService } from '@klenzo/messaging';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private eventBus: EventBusService,
  ) {}

  async register(email: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      email,
      passwordHash: hashedPassword,
    });
    const savedUser = await this.userRepository.save(user);
    this.eventBus.publish('user.created', { userId: savedUser.id, email: savedUser.email });
    return { message: 'User registered' };
  }

  async login(email: string, password: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'secret_key');
    await this.userRepository.update(user.id, { lastLogin: new Date() });
    this.eventBus.publish('user.logged_in', { userId: user.id, email: user.email });
    return { token };
  }
}
