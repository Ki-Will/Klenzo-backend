import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface UserPayload {
  id: string;
  email: string;
  name?: string | null;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles('admin', 'superadmin')
@Controller('admin/support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  @RequirePermissions('support.read')
  list(@Query('status') status?: string) {
    return this.supportService.list(status);
  }

  @Get(':id')
  @RequirePermissions('support.read')
  getById(@Param('id') id: string) {
    return this.supportService.getById(id);
  }

  @Post()
  @RequirePermissions('support.create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: UserPayload,
    @Body() dto: { userId: string; subject: string; description: string; priority?: string },
  ) {
    return this.supportService.create(user.id, dto);
  }

  @Patch(':id')
  @RequirePermissions('support.update')
  update(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: { status?: string; priority?: string; assignedTo?: string | null },
  ) {
    return this.supportService.update(user.id, id, dto);
  }

  @Post(':id/escalate')
  @RequirePermissions('support.escalate')
  @HttpCode(HttpStatus.OK)
  escalate(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.supportService.escalate(user.id, id);
  }

  @Post(':id/close')
  @RequirePermissions('support.close')
  @HttpCode(HttpStatus.OK)
  close(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.supportService.close(user.id, id);
  }

  @Post(':id/messages')
  @RequirePermissions('support.update')
  @HttpCode(HttpStatus.CREATED)
  addMessage(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: { message: string },
  ) {
    return this.supportService.addMessage(user.id, user.name, id, dto.message);
  }
}
