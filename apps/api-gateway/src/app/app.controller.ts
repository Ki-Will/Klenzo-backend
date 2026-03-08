import { Controller, Post, Get, Body, Inject, UseGuards, Request } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AppController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) { }

  @Post('register')
  async register(@Body() body: any) {
    return firstValueFrom(this.authClient.send('auth.register', body));
  }

  @Post('login')
  async login(@Body() body: any) {
    return firstValueFrom(this.authClient.send('auth.login', body));
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }
}
