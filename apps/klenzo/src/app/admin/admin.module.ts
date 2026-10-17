import { Module, forwardRef } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { RbacModule } from './rbac/rbac.module';
import { ConsentModule } from './consent/consent.module';
import { ApprovalModule } from './approval/approval.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    NotificationModule,
    RbacModule,
    ConsentModule,
    ApprovalModule,
    SupportModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
