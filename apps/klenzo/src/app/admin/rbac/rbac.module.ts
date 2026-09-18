import { Module, Global, forwardRef } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';

@Global()
@Module({
  imports: [forwardRef(() => AuthModule), PrismaModule, RedisModule],
  controllers: [RbacController],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
