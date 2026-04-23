import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';

@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('user.created')
  async handleUserCreated(@Payload() data: { email: string }) {
    await this.notificationService.sendEmail(
      data.email,
      'Welcome to Klenzo!',
      'Thank you for joining Klenzo. Start your productivity journey today!'
    );
  }

  @EventPattern('user.password_reset_request')
  async handlePasswordReset(@Payload() data: { email: string; resetToken: string }) {
    await this.notificationService.sendEmail(
      data.email,
      'Password Reset Request',
      `Your reset token is: ${data.resetToken}. If you didn't request this, ignore this email.`
    );
  }

  @EventPattern('habit.completed')
  async handleHabitCompleted(@Payload() data: { userId: number; habitId: number; streak: number }) {
    // In a real app, you'd fetch the user's email first.
    // This is a placeholder for logic that could trigger push/email.
  }
}
