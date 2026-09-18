import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles('admin', 'superadmin')
@Controller('admin/feature-flags')
export class FeatureFlagController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Get()
  @RequirePermissions('feature_flags.read')
  getAllFlags() {
    return this.featureFlagService.getAllFlags();
  }

  @Get(':name')
  @RequirePermissions('feature_flags.read')
  getFlagByName(@Param('name') name: string) {
    return this.featureFlagService.getFlagByName(name);
  }

  @Post()
  @RequirePermissions('feature_flags.manage')
  @HttpCode(HttpStatus.CREATED)
  createFlag(
    @CurrentUser() user: UserPayload,
    @Body()
    dto: {
      name: string;
      description?: string;
      isEnabled?: boolean;
      rolloutPercent?: number;
      allowedUsers?: string[];
      allowedRoles?: string[];
      allowedCountries?: string[];
    },
  ) {
    return this.featureFlagService.createFlag({
      ...dto,
      createdBy: user.id,
    });
  }

  @Patch(':name')
  @RequirePermissions('feature_flags.manage')
  updateFlag(
    @CurrentUser() user: UserPayload,
    @Param('name') name: string,
    @Body()
    dto: {
      description?: string;
      isEnabled?: boolean;
      rolloutPercent?: number;
      allowedUsers?: string[];
      allowedRoles?: string[];
      allowedCountries?: string[];
    },
  ) {
    return this.featureFlagService.updateFlag(name, {
      ...dto,
      updatedBy: user.id,
    });
  }

  @Delete(':name')
  @RequirePermissions('feature_flags.manage')
  @HttpCode(HttpStatus.OK)
  deleteFlag(@Param('name') name: string) {
    return this.featureFlagService.deleteFlag(name);
  }

  @Post('seed')
  @Roles('superadmin')
  @RequirePermissions('feature_flags.manage')
  seedDefaults() {
    return this.featureFlagService.seedDefaults();
  }
}
