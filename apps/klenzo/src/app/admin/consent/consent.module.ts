import { Module } from '@nestjs/common';
import { ConsentService } from './consent.service';
import {
  ConsentUserController,
  ConsentAdminController,
} from './consent.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [PrismaModule, RbacModule],
  providers: [ConsentService],
  controllers: [ConsentUserController, ConsentAdminController],
  exports: [ConsentService],
})
export class ConsentModule {}
