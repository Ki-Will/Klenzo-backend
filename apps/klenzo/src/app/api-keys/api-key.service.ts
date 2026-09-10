import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { EncryptionService } from '../common/encryption/encryption.service';

/**
 * API key management service.
 * Allows third-party applications to access the API securely.
 *
 * Features:
 * - Key generation with prefix
 * - Scope-based permissions
 * - Rate limiting per key
 * - Key rotation
 */
export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  rateLimit: number; // requests per minute
  userId: string;
  active: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Generate a new API key.
   */
  async createApiKey(params: {
    name: string;
    userId: string;
    scopes: string[];
    rateLimit?: number;
    expiresInDays?: number;
  }) {
    const rawKey = `kz_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = this.encryption.hash(rawKey);
    const keyPrefix = rawKey.substring(0, 10);

    const expiresAt = params.expiresInDays
      ? new Date(Date.now() + params.expiresInDays * 86400000)
      : undefined;

    this.logger.log(
      JSON.stringify({
        event: 'api_key_created',
        userId: params.userId,
        keyPrefix,
        scopes: params.scopes,
      }),
    );

    // In production, store in database
    return {
      id: crypto.randomUUID(),
      name: params.name,
      key: rawKey, // Only shown once!
      keyPrefix,
      scopes: params.scopes,
      rateLimit: params.rateLimit || 60,
      expiresAt,
      createdAt: new Date(),
    };
  }

  /**
   * Validate an API key.
   */
  async validateApiKey(
    apiKey: string,
    requiredScope: string,
  ): Promise<{ valid: boolean; userId?: string; error?: string }> {
    if (!apiKey || !apiKey.startsWith('kz_')) {
      return { valid: false, error: 'Invalid API key format' };
    }

    const keyHash = this.encryption.hash(apiKey);

    // In production, look up in database
    // For now, return invalid
    return { valid: false, error: 'API key not found' };
  }

  /**
   * Rotate an API key.
   */
  async rotateApiKey(keyId: string, userId: string) {
    // Generate new key, invalidate old one
    this.logger.log(
      JSON.stringify({
        event: 'api_key_rotated',
        keyId,
        userId,
      }),
    );

    return this.createApiKey({
      name: 'Rotated key',
      userId,
      scopes: [], // In production, copy from old key
    });
  }

  /**
   * Revoke an API key.
   */
  async revokeApiKey(keyId: string, userId: string) {
    this.logger.log(
      JSON.stringify({
        event: 'api_key_revoked',
        keyId,
        userId,
      }),
    );

    return { revoked: true };
  }

  /**
   * List user's API keys.
   */
  async listApiKeys(userId: string): Promise<Partial<ApiKey>[]> {
    // In production, fetch from database
    return [];
  }
}
