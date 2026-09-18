/**
 * Klenzoo Feature Flags Module
 *
 * Provides feature flag evaluation with:
 * - Global enable/disable
 * - Percentage-based rollout (deterministic per user)
 * - Country gating
 * - Role whitelisting
 * - User whitelisting
 * - Redis caching (60s TTL)
 * - Admin CRUD API
 * - Audit logging on all changes
 */

import { Module, Global, forwardRef } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureFlagController } from './feature-flag.controller';
import { FeatureFlagGuard } from './feature-flag.guard';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [FeatureFlagController],
  providers: [FeatureFlagService, FeatureFlagGuard],
  exports: [FeatureFlagService, FeatureFlagGuard],
})
export class FeatureFlagModule {}
