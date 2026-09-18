import { Module, forwardRef } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { RbacModule } from './rbac/rbac.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    NotificationModule,
    RbacModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
