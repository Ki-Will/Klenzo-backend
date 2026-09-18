import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagService } from './feature-flag.service';

export const FEATURE_FLAG_KEY = 'feature_flag';

/**
 * Decorator to require a feature flag to be enabled.
 *
 * Usage:
 *   @UseGuards(FeatureFlagGuard)
 *   @RequireFeatureFlag('payroll_module')
 *   @Get('payroll')
 *   async getPayroll() { ... }
 */
export const RequireFeatureFlag = (flagName: string) =>
  (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(FEATURE_FLAG_KEY, flagName, descriptor?.value ?? target);
    return descriptor;
  };

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlagService: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagName = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!flagName) return true; // No flag required

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const isEnabled = await this.featureFlagService.isEnabled(flagName, {
      userId: user?.id,
      userRole: user?.role,
      country: request.headers['x-country'] || undefined,
    });

    if (!isEnabled) {
      throw new ForbiddenException(
        `Feature "${flagName}" is not available at this time`,
      );
    }

    return true;
  }
}
