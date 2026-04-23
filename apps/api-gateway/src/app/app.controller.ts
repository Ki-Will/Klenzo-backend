import { Controller, Post, Get, Body, Inject, UseGuards, Request, Param } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AppController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    @Inject('PRODUCTIVITY_SERVICE') private readonly productivityClient: ClientProxy,
    @Inject('HABIT_SERVICE') private readonly habitClient: ClientProxy,
    @Inject('FINANCE_SERVICE') private readonly financeClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
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

  @UseGuards(JwtAuthGuard)
  @Post('profile/update')
  async updateProfile(@Request() req: any, @Body() body: any) {
    return firstValueFrom(this.authClient.send('auth.profile.update', { userId: req.user.id, dto: body }));
  }

  // Productivity Service Endpoints
  @UseGuards(JwtAuthGuard)
  @Post('productivity/tasks')
  async createTask(@Request() req: any, @Body() body: any) {
    return firstValueFrom(this.productivityClient.send('productivity.task.create', { userId: req.user.id, dto: body }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('productivity/tasks')
  async getTasks(@Request() req: any) {
    return firstValueFrom(this.productivityClient.send('productivity.task.findAll', { userId: req.user.id }));
  }

  @UseGuards(JwtAuthGuard)
  @Post('productivity/tasks/:id/update')
  async updateTask(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return firstValueFrom(this.productivityClient.send('productivity.task.update', { userId: req.user.id, taskId: +id, dto: body }));
  }

  @UseGuards(JwtAuthGuard)
  @Post('productivity/tasks/:id/delete')
  async deleteTask(@Request() req: any, @Param('id') id: string) {
    return firstValueFrom(this.productivityClient.send('productivity.task.delete', { userId: req.user.id, taskId: +id }));
  }

  // Habit Service Endpoints
  @UseGuards(JwtAuthGuard)
  @Post('habits')
  async createHabit(@Request() req: any, @Body() body: any) {
    return firstValueFrom(this.habitClient.send('habit.create', { userId: req.user.id, dto: body }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('habits')
  async getHabits(@Request() req: any) {
    return firstValueFrom(this.habitClient.send('habit.findAll', { userId: req.user.id }));
  }

  @UseGuards(JwtAuthGuard)
  @Post('habits/:id/complete')
  async completeHabit(@Request() req: any, @Param('id') id: string) {
    return firstValueFrom(this.habitClient.send('habit.complete', { userId: req.user.id, habitId: +id }));
  }

  @UseGuards(JwtAuthGuard)
  @Post('habits/:id/delete')
  async deleteHabit(@Request() req: any, @Param('id') id: string) {
    return firstValueFrom(this.habitClient.send('habit.delete', { userId: req.user.id, habitId: +id }));
  }

  // Group Endpoints (Finance Service)
  @UseGuards(JwtAuthGuard)
  @Post('finance/groups')
  async createGroup(@Request() req: any, @Body() body: any) {
    return firstValueFrom(this.financeClient.send('finance.groups.create', { userId: req.user.id, dto: body }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('finance/groups')
  async getGroups(@Request() req: any) {
    return firstValueFrom(this.financeClient.send('finance.groups.findAll', { userId: req.user.id }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('finance/groups/:id')
  async getGroupDetail(@Request() req: any, @Param('id') id: string) {
    return firstValueFrom(this.financeClient.send('finance.groups.findOne', { groupId: +id }));
  }

  // Analytics Endpoints (Finance Service)
  @UseGuards(JwtAuthGuard)
  @Get('finance/analytics/summary')
  async getSpendingSummary(@Request() req: any) {
    return firstValueFrom(this.financeClient.send('finance.analytics.summary', { userId: req.user.id }));
  }

  // Notification Endpoints
  @UseGuards(JwtAuthGuard)
  @Get('notifications')
  async getNotifications(@Request() req: any) {
    return firstValueFrom(this.notificationClient.send('notification.findAll', { userId: req.user.id }));
  }

  @UseGuards(JwtAuthGuard)
  @Post('notifications/:id/read')
  async markAsRead(@Request() req: any, @Param('id') id: string) {
    return firstValueFrom(this.notificationClient.send('notification.markAsRead', { notificationId: +id, userId: req.user.id }));
  }
}
