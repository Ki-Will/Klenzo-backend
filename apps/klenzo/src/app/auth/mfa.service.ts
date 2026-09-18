import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly issuer = process.env.MFA_ISSUER || 'Klenzo';

  constructor(private readonly prisma: PrismaService) {}

  // ─── Setup ─────────────────────────────────────────────────────────────────
  // Generates a new TOTP secret and persists it (but doesn't enable MFA yet).
  // The user must prove they can read the code via enable().

  async setup(
    userId: string,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.mfaEnabled) {
      throw new ConflictException(
        'Two-factor authentication is already enabled',
      );
    }

    const secret = speakeasy.generateSecret({
      name: `Klenzo (${user.email})`,
      issuer: this.issuer,
      length: 32,
    });

    // Persist secret but keep mfaEnabled=false until the user verifies a code
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret.base32 },
    });

    this.logger.log(`MFA secret generated for ${user.email}`);

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url!,
    };
  }

  // ─── Enable ────────────────────────────────────────────────────────────────
  // Verifies the first code (to confirm the authenticator app is set up) then
  // flips mfaEnabled=true.

  async enable(
    userId: string,
    code: string,
  ): Promise<{ mfaEnabled: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.mfaEnabled) {
      throw new ConflictException('MFA is already enabled');
    }
    if (!user.mfaSecret) {
      throw new BadRequestException(
        'MFA setup has not been started. Call POST /auth/mfa/setup first.',
      );
    }

    this.verifyCode(user.mfaSecret, code);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    this.logger.log(`MFA enabled for ${user.email}`);

    return { mfaEnabled: true };
  }

  // ─── Disable ───────────────────────────────────────────────────────────────
  // Requires a valid code from the current authenticator as confirmation.

  async disable(
    userId: string,
    code: string,
  ): Promise<{ mfaEnabled: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.mfaEnabled) {
      throw new ConflictException('MFA is not currently enabled');
    }
    if (!user.mfaSecret) {
      throw new BadRequestException(
        'MFA secret is missing — contact support',
      );
    }

    this.verifyCode(user.mfaSecret, code);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    this.logger.log(`MFA disabled for ${user.email}`);

    return { mfaEnabled: false };
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  async status(userId: string): Promise<{ mfaEnabled: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return { mfaEnabled: user.mfaEnabled };
  }

  // ─── Verify challenge (used during login) ─────────────────────────────────

  async verifyChallenge(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('MFA is not enabled');
    }

    return this.verifyCode(user.mfaSecret, code);
  }

  // ─── Helper ────────────────────────────────────────────────────────────────

  private verifyCode(base32Secret: string, code: string): boolean {
    const valid = speakeasy.totp.verify({
      secret: base32Secret,
      encoding: 'base32',
      token: code.trim(),
      window: 1, // Allow 30s drift in each direction
    });

    if (!valid) {
      throw new UnauthorizedException('Invalid authentication code');
    }

    return true;
  }
}
