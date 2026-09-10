import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * WebAuthn (FIDO2) service for biometric authentication.
 * Supports fingerprint, face ID, and security keys.
 *
 * Flow:
 * 1. Registration: Server sends challenge → Client uses biometric → Server verifies
 * 2. Authentication: Server sends challenge → Client uses biometric → Server verifies
 */
export interface WebAuthnCredential {
  id: string;
  publicKey: string;
  counter: number;
  userId: string;
  deviceName: string;
  createdAt: Date;
}

@Injectable()
export class WebAuthnService {
  private readonly logger = new Logger(WebAuthnService.name);
  private readonly rpName = 'Klenzo';
  private readonly rpId = process.env.WEB_AUTHN_RP_ID || 'localhost';

  /**
   * Generate registration options.
   * Called before the client performs biometric authentication.
   */
  async generateRegistrationOptions(userId: string, email: string) {
    const challenge = crypto.randomBytes(32);

    return {
      challenge: challenge.toString('base64url'),
      rp: {
        name: this.rpName,
        id: this.rpId,
      },
      user: {
        id: userId,
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };
  }

  /**
   * Verify registration response.
   */
  async verifyRegistration(
    userId: string,
    credential: {
      id: string;
      rawId: string;
      response: {
        attestationObject: string;
        clientDataJSON: string;
      };
    },
    deviceName: string,
  ) {
    // In production, verify the attestation object
    // For now, store the credential
    this.logger.log(
      JSON.stringify({
        event: 'webauthn_registration',
        userId,
        credentialId: credential.id,
        deviceName,
      }),
    );

    return {
      verified: true,
      credential: {
        id: credential.id,
        userId,
        deviceName,
        createdAt: new Date(),
      },
    };
  }

  /**
   * Generate authentication options.
   */
  async generateAuthenticationOptions(userId?: string) {
    const challenge = crypto.randomBytes(32);

    return {
      challenge: challenge.toString('base64url'),
      rpId: this.rpId,
      userVerification: 'required',
      timeout: 60000,
      allowCredentials: userId
        ? [] // In production, fetch user's registered credentials
        : undefined,
    };
  }

  /**
   * Verify authentication response.
   */
  async verifyAuthentication(
    credential: {
      id: string;
      rawId: string;
      response: {
        authenticatorData: string;
        clientDataJSON: string;
        signature: string;
      };
    },
    expectedChallenge: string,
  ) {
    // In production, verify the signature against the stored public key
    this.logger.log(
      JSON.stringify({
        event: 'webauthn_authentication',
        credentialId: credential.id,
      }),
    );

    return {
      verified: true,
      userId: '', // In production, look up from credential
    };
  }

  /**
   * List user's registered credentials.
   */
  async listCredentials(userId: string): Promise<WebAuthnCredential[]> {
    // In production, fetch from database
    return [];
  }

  /**
   * Delete a registered credential.
   */
  async deleteCredential(credentialId: string, userId: string) {
    this.logger.log(
      JSON.stringify({
        event: 'webauthn_credential_deleted',
        credentialId,
        userId,
      }),
    );
    return { deleted: true };
  }
}
