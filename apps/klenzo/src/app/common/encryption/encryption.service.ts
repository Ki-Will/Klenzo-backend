import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Encryption service for PII data at rest.
 * Uses AES-256-GCM for authenticated encryption.
 * Fields like SSN, KYC document numbers, etc. should be encrypted before storage.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      this.logger.warn(
        'ENCRYPTION_KEY not set. PII encryption disabled. Set ENCRYPTION_KEY in production.',
      );
      // Derive a key from a default for dev only — NEVER use in production
      this.key = crypto.scryptSync(
        'klenzo-dev-key-do-not-use-in-production',
        'salt',
        32,
      );
    } else {
      this.key = Buffer.from(encryptionKey, 'hex');
    }
  }

  /**
   * Encrypt a string value.
   * Returns base64-encoded string with IV + auth tag + ciphertext.
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext (all hex)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt an encrypted string value.
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext || !ciphertext.includes(':')) return ciphertext;

    try {
      const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (err) {
      this.logger.error('Decryption failed — data may not be encrypted');
      return ciphertext;
    }
  }

  /**
   * Hash a value (one-way, for searching encrypted fields).
   * Uses SHA-256 for deterministic hashing.
   */
  hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Check if a value appears to be encrypted.
   */
  isEncrypted(value: string): boolean {
    if (!value) return false;
    const parts = value.split(':');
    return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/.test(p));
  }
}
