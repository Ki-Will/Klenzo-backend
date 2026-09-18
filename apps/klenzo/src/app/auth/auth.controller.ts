import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { R2Service } from '../storage/r2.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from './jwt.strategy';
import { GoogleOAuthService } from './google-oauth.service';

import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
  ChangePasswordDto,
  GoogleTokenDto,
  MfaLoginDto,
  EnableMfaDto,
  DisableMfaDto,
} from '../dto/auth.dto';

/**
 * COOKIE CONFIG
 *
 * IMPORTANT:
 * - sameSite: 'lax' is correct for Next.js proxy setups
 * - secure MUST be false in localhost/dev
 * - no domain property
 * - path must be '/'
 */
function cookieOptions(maxAge: number) {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

function clearCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly r2Service: R2Service,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

  // ───────────────── REGISTER ─────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const device = req.headers['user-agent'] || 'Unknown device';

    const result = await this.authService.register(dto, device);

    res.cookie('kz_at', result.accessToken, cookieOptions(15 * 60 * 1000));

    res.cookie(
      'kz_rt',
      result.refreshToken,
      cookieOptions(7 * 24 * 60 * 60 * 1000),
    );

    return {
      success: true,
      message: result.message,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  // ───────────────── LOGIN ─────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    console.log(`[Auth] Login attempt: ${dto.email}`);

    const device = req.headers['user-agent'] || 'Unknown device';

    try {
      const result = await this.authService.login(dto, device);

      console.log(`[Auth] Login success: ${dto.email}`);

      // ACCESS TOKEN
      res.cookie('kz_at', result.accessToken, cookieOptions(15 * 60 * 1000));

      // REFRESH TOKEN
      res.cookie(
        'kz_rt',
        result.refreshToken,
        cookieOptions(7 * 24 * 60 * 60 * 1000),
      );

      return {
        success: true,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };
    } catch (err) {
      console.error(`[Auth] Login failed: ${dto.email}`, err);
      throw err;
    }
  }

  // ───────────────── REFRESH ─────────────────

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.kz_rt;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const tokens = await this.authService.refresh(refreshToken);

    res.cookie('kz_at', tokens.accessToken, cookieOptions(15 * 60 * 1000));

    res.cookie(
      'kz_rt',
      tokens.refreshToken,
      cookieOptions(7 * 24 * 60 * 60 * 1000),
    );

    return {
      success: true,
      accessToken: tokens.accessToken,
    };
  }

  // ───────────────── LOGOUT ─────────────────

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: UserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.id);

    res.clearCookie('kz_at', clearCookieOptions());
    res.clearCookie('kz_rt', clearCookieOptions());

    return {
      success: true,
    };
  }

  // ───────────────── FORGOT PASSWORD ─────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // ───────────────── RESET PASSWORD ─────────────────

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  // ───────────────── PROFILE ─────────────────

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() user: UserPayload) {
    return this.authService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile')
  @HttpCode(HttpStatus.OK)
  updateProfile(@CurrentUser() user: UserPayload, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }

  // ───────────────── AVATAR ─────────────────

  @UseGuards(JwtAuthGuard)
  @Post('profile/avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: UserPayload,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new UnauthorizedException('File is required');
    }

    const secureUrl = await this.r2Service.uploadFile(file, 'klenzo/avatars');

    return this.authService.updateProfile(user.id, {
      avatar: secureUrl,
    } as any);
  }

  // ───────────────── CHANGE PASSWORD ─────────────────

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(@CurrentUser() user: UserPayload, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // ───────────────── SESSIONS ─────────────────

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  getSessions(@CurrentUser() user: UserPayload) {
    return this.authService.getSessions(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:id/revoke')
  @HttpCode(HttpStatus.OK)
  revokeSession(@CurrentUser() user: UserPayload, @Param('id') sessionId: string) {
    return this.authService.revokeSession(user.id, sessionId);
  }

  // ───────────────── GOOGLE OAUTH ─────────────────

  /**
   * GET /auth/google/url
   * Returns a Google authorization URL for the frontend to redirect the user
   * to. An optional `redirect` query param specifies where to send the user
   * back in the frontend after the OAuth flow completes.
   */
  @Get('google/url')
  @HttpCode(HttpStatus.OK)
  googleUrl(@Query('redirect') redirect?: string) {
    return this.googleOAuth.getAuthorizationUrl(redirect);
  }

  /**
   * GET /auth/google/callback
   * Google redirects the user back to this URL with ?code= and ?state=.
   * The server exchanges the code for tokens, creates/links the user, sets
   * the httpOnly cookies, and redirects the browser to the frontend.
   *
   * If the user has MFA enabled, redirects with ?status=mfa_required&token=.
   */
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    if (!code || !state) {
      throw new UnauthorizedException('Missing authorization code or state');
    }

    const device = req.headers['user-agent'] || 'Unknown device';
    const frontendUrl =
      process.env.FRONTEND_URL || 'http://localhost:5000';

    try {
      const result = await this.googleOAuth.callback(code, state, device);

      if ('mfaRequired' in result && result.mfaRequired) {
        const target = new URL(`${frontendUrl}/oauth/callback`);
        target.searchParams.set('status', 'mfa_required');
        target.searchParams.set('token', result.mfaToken);
        target.searchParams.set('redirect', result.redirect);
        return res.redirect(target.toString());
      }

      res.cookie('kz_at', result.accessToken, cookieOptions(15 * 60 * 1000));
      res.cookie(
        'kz_rt',
        result.refreshToken,
        cookieOptions(7 * 24 * 60 * 60 * 1000),
      );

      const target = new URL(`${frontendUrl}/oauth/callback`);
      target.searchParams.set('status', 'success');
      target.searchParams.set('redirect', result.redirect);
      return res.redirect(target.toString());
    } catch (err) {
      const target = new URL(`${frontendUrl}/oauth/callback`);
      target.searchParams.set('status', 'error');
      target.searchParams.set(
        'message',
        err instanceof Error ? err.message : 'Authentication failed',
      );
      return res.redirect(target.toString());
    }
  }

  /**
   * POST /auth/google/token
   * Accepts a Google ID token directly (used by mobile and PWA flows).
   * Creates/links the user and returns auth tokens.
   */
  @Post('google/token')
  @HttpCode(HttpStatus.OK)
  async googleToken(
    @Body() dto: GoogleTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const device = req.headers['user-agent'] || 'Unknown device';

    const result = await this.googleOAuth.authenticateWithIdToken(
      dto.idToken,
      device,
    );

    if ('mfaRequired' in result && result.mfaRequired) {
      return { mfaRequired: true as const, mfaToken: result.mfaToken };
    }

    res.cookie('kz_at', result.accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie(
      'kz_rt',
      result.refreshToken,
      cookieOptions(7 * 24 * 60 * 60 * 1000),
    );

    return {
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  // ───────────────── MFA ─────────────────

  /**
   * POST /auth/login/mfa
   * Second step for login when MFA is enabled.
   */
  @Post('login/mfa')
  @HttpCode(HttpStatus.OK)
  async loginMfa(
    @Body() dto: MfaLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const device = req.headers['user-agent'] || 'Unknown device';

    const result = await this.authService.mfaLogin(
      dto.mfaToken,
      dto.code,
      device,
    );

    res.cookie('kz_at', result.accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie(
      'kz_rt',
      result.refreshToken,
      cookieOptions(7 * 24 * 60 * 60 * 1000),
    );

    return {
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('mfa/status')
  mfaStatus(@CurrentUser() user: UserPayload) {
    return this.authService.mfaStatus(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  mfaSetup(@CurrentUser() user: UserPayload) {
    return this.authService.mfaSetup(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/enable')
  @HttpCode(HttpStatus.OK)
  mfaEnable(@CurrentUser() user: UserPayload, @Body() dto: EnableMfaDto) {
    return this.authService.mfaEnable(user.id, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  mfaDisable(@CurrentUser() user: UserPayload, @Body() dto: DisableMfaDto) {
    return this.authService.mfaDisable(user.id, dto.code);
  }
}
