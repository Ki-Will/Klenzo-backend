import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

interface GoogleProfile {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private readonly clientId = process.env.GOOGLE_CLIENT_ID;
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  private readonly redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    'http://localhost:3000/api/auth/google/callback';
  private readonly frontendUrl =
    process.env.FRONTEND_URL || 'http://localhost:5000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  private ensureConfigured(): void {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException(
        'Google OAuth is not configured on the server',
      );
    }
  }

  // ─── Authorization URL ────────────────────────────────────────────────────

  getAuthorizationUrl(redirect?: string): { url: string } {
    this.ensureConfigured();

    const state = this.jwtService.sign(
      { redirect: redirect ?? '/' },
      { expiresIn: '10m' },
    );

    const url = new URL(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    url.searchParams.set('client_id', this.clientId!);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('prompt', 'select_account');
    url.searchParams.set('state', state);

    return { url: url.toString() };
  }

  // ─── Callback (code exchange) ─────────────────────────────────────────────

  async callback(
    code: string,
    state: string,
    device?: string,
  ): Promise<
    | { accessToken: string; refreshToken: string; user: any; redirect: string }
    | { mfaRequired: true; mfaToken: string; redirect: string }
  > {
    this.ensureConfigured();

    let payload: { redirect?: string };
    try {
      payload = this.jwtService.verify(state);
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }

    const redirect =
      typeof payload.redirect === 'string' &&
      payload.redirect.startsWith('/')
        ? payload.redirect
        : '/';

    const profile = await this.exchangeCode(code);
    return this.authenticate(profile, device, redirect);
  }

  // ─── ID token verification (used by mobile + client-side flows) ───────────

  async authenticateWithIdToken(
    idToken: string,
    device?: string,
  ): Promise<
    | { accessToken: string; refreshToken: string; user: any; redirect: string }
    | { mfaRequired: true; mfaToken: string; redirect: string }
  > {
    this.ensureConfigured();
    const profile = await this.verifyIdToken(idToken);
    return this.authenticate(profile, device, '/');
  }

  // ─── Shared logic ─────────────────────────────────────────────────────────

  private async authenticate(
    profile: GoogleProfile,
    device: string | undefined,
    redirect: string,
  ) {
    const user = await this.findOrCreateUser(profile);

    if (user.mfaEnabled) {
      const mfaToken = this.jwtService.sign(
        { sub: user.id, type: 'mfa_challenge' },
        { expiresIn: '10m' },
      );
      return { mfaRequired: true as const, mfaToken, redirect };
    }

    const session = await this.authService.issueSession(user, device);
    return { ...session, redirect };
  }

  // ─── Google exchange ──────────────────────────────────────────────────────

  private async exchangeCode(code: string): Promise<GoogleProfile> {
    const res = await fetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId!,
          client_secret: this.clientSecret!,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      this.logger.error('Google token exchange failed', body);
      throw new UnauthorizedException('Failed to exchange Google authorization code');
    }

    const data = await res.json();
    return this.fetchUserInfo(data.access_token);
  }

  private async fetchUserInfo(accessToken: string): Promise<GoogleProfile> {
    const res = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!res.ok) {
      throw new UnauthorizedException('Failed to fetch Google user info');
    }

    const data = await res.json();
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  }

  // ─── ID token verification ────────────────────────────────────────────────

  private async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );

    if (!res.ok) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    const data = await res.json();

    if (this.clientId && data.aud !== this.clientId) {
      throw new UnauthorizedException(
        'Google ID token audience mismatch',
      );
    }

    return {
      id: data.sub,
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  }

  // ─── Find or create user ──────────────────────────────────────────────────

  private async findOrCreateUser(
    profile: GoogleProfile,
  ): Promise<any> {
    if (!profile.email) {
      throw new UnauthorizedException(
        'Google account does not have an email address',
      );
    }

    // Try linking to an existing user by googleId
    const existingByGoogle = await this.prisma.user.findUnique({
      where: { googleId: profile.id },
    });
    if (existingByGoogle) return existingByGoogle;

    // Try linking to an existing user by email
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (existingByEmail) {
      this.logger.log(
        `Linking Google account (${profile.id}) to existing user ${profile.email}`,
      );
      return this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleId: profile.id,
          name: existingByEmail.name ?? profile.name ?? null,
          avatar: existingByEmail.avatar ?? profile.picture ?? null,
        },
      });
    }

    // Create a new user (unusable random password — can't login with password)
    this.logger.log(`Creating new user from Google account: ${profile.email}`);
    const randomHash = await bcrypt.hash(
      crypto.randomBytes(32).toString('hex'),
      10,
    );

    return this.prisma.user.create({
      data: {
        email: profile.email,
        googleId: profile.id,
        name: profile.name ?? null,
        avatar: profile.picture ?? null,
        passwordHash: randomHash,
      },
    });
  }
}
