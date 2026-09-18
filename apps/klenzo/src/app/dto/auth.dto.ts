import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class UpdateProfileDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsOptional()
  notificationSettings?: {
    smartInsights: boolean;
    transactionAlerts: boolean;
    securityAlerts: boolean;
    groupAlerts: boolean;
  };
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

// ── Google OAuth ─────────────────────────────────────────────────────────────

export class GoogleTokenDto {
  @IsString()
  idToken: string;
}

// ── MFA ──────────────────────────────────────────────────────────────────────

export class MfaLoginDto {
  @IsString()
  mfaToken: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class EnableMfaDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class DisableMfaDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}
