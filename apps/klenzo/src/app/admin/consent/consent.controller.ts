import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConsentService } from './consent.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// ─── User Endpoints (authenticated users) ──────────────────────────────────

@UseGuards(JwtAuthGuard)
@Controller('consent')
export class ConsentUserController {
  constructor(private readonly consentService: ConsentService) {}

  @Get()
  getMyConsents(@CurrentUser() user: any) {
    return this.consentService.getUserConsents(user.id);
  }

  @Get('types')
  getConsentTypes() {
    return this.consentService.getConsentTypes();
  }

  @Get('check')
  checkMyPolicyConsent(@CurrentUser() user: any) {
    return this.consentService.checkPolicyConsent(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  recordConsent(
    @CurrentUser() user: any,
    @Body() dto: { consentType: string; version: string; granted: boolean },
    @Req() req: any,
  ) {
    return this.consentService.recordConsent(
      user.id,
      dto.consentType,
      dto.version,
      dto.granted,
      req.ip,
      req.get('user-agent'),
    );
  }

  @Delete(':consentType')
  revokeConsent(
    @CurrentUser() user: any,
    @Param('consentType') consentType: string,
  ) {
    return this.consentService.revokeConsent(user.id, consentType);
  }
}

// ─── Admin Endpoints ───────────────────────────────────────────────────────

@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles('admin', 'superadmin')
@Controller('admin/consent')
export class ConsentAdminController {
  constructor(private readonly consentService: ConsentService) {}

  @Get('users/:userId')
  @RequirePermissions('users.read')
  getUserConsents(@Param('userId') userId: string) {
    return this.consentService.getUserConsents(userId);
  }

  @Get('users/:userId/check')
  @RequirePermissions('users.read')
  checkUserPolicyConsent(@Param('userId') userId: string) {
    return this.consentService.checkPolicyConsent(userId);
  }

  // ─── Policy Version Management ──────────────────────────────────────────

  @Get('policies')
  @RequirePermissions('platform.settings_read')
  getAllPolicies(@Query('type') type?: string) {
    return this.consentService.getAllPolicyVersions(type);
  }

  @Get('policies/:type/latest')
  @RequirePermissions('platform.settings_read')
  getLatestPolicy(@Param('type') type: string) {
    return this.consentService.getLatestPolicyVersion(type);
  }

  @Post('policies')
  @RequirePermissions('platform.settings_manage')
  @HttpCode(HttpStatus.CREATED)
  createPolicyVersion(
    @Body()
    dto: {
      policyType: string;
      version: string;
      effectiveDate: string;
      contentUrl: string;
      requiresConsent?: boolean;
    },
  ) {
    return this.consentService.createPolicyVersion(
      dto.policyType,
      dto.version,
      new Date(dto.effectiveDate),
      dto.contentUrl,
      dto.requiresConsent,
    );
  }
}
