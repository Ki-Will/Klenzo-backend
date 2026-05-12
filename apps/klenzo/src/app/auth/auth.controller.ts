import {
  Controller,
  Post,
  Get,
  Body,
  Param,
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
import { User } from '../entities/user.entity';

import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from '../dto/auth.dto';

import { Multer } from 'multer';
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
    @CurrentUser() user: User,
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
  getProfile(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile')
  @HttpCode(HttpStatus.OK)
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }

  // ───────────────── AVATAR ─────────────────

  @UseGuards(JwtAuthGuard)
  @Post('profile/avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
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
  changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // ───────────────── SESSIONS ─────────────────

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  getSessions(@CurrentUser() user: User) {
    return this.authService.getSessions(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:id/revoke')
  @HttpCode(HttpStatus.OK)
  revokeSession(@CurrentUser() user: User, @Param('id') sessionId: string) {
    return this.authService.revokeSession(user.id, sessionId);
  }
}
