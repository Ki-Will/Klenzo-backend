import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EventBusService } from '@klenzo/messaging';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly eventBus: EventBusService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025'),
      secure: false,
    });
  }

  onModuleInit() {
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    // This is a simplified version. In a real scenario, you'd use @EventPattern
    // or a more robust subscription mechanism from the MessagingModule.
    // For now, we'll assume the service handles specific events.
    this.logger.log('Notification Service subscribed to events');
  }

  async sendEmail(to: string, subject: string, text: string) {
    try {
      await this.transporter.sendMail({
        from: '"Klenzo" <noreply@klenzo.com>',
        to,
        subject,
        text,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error.stack);
    }
  }
}
