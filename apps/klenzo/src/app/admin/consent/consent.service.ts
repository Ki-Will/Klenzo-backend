import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const CONSENT_TYPES = [
  { type: 'terms_of_service', required: true, revocable: false, description: 'Platform terms of service' },
  { type: 'privacy_policy', required: true, revocable: false, description: 'Data processing policy' },
  { type: 'marketing_email', required: false, revocable: true, description: 'Promotional emails' },
  { type: 'marketing_sms', required: false, revocable: true, description: 'Promotional SMS' },
  { type: 'push_notifications', required: false, revocable: true, description: 'App push alerts' },
  { type: 'analytics', required: false, revocable: true, description: 'Usage analytics collection' },
  { type: 'data_sharing_partners', required: false, revocable: true, description: 'Sharing with licensed partners' },
] as const;

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Record Consent ─────────────────────────────────────────────────────

  async recordConsent(
    userId: string,
    consentType: string,
    version: string,
    granted: boolean,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const consentDef = CONSENT_TYPES.find((c) => c.type === consentType);
    if (!consentDef) {
      throw new BadRequestException(`Unknown consent type: ${consentType}`);
    }

    // Check if user already has a record for this consent type
    const existing = await this.prisma.consentRecord.findUnique({
      where: {
        userId_consentType: {
          userId,
          consentType,
        },
      },
    });

    if (existing) {
      // Update existing record
      return this.prisma.consentRecord.update({
        where: { id: existing.id },
        data: {
          version,
          granted,
          revokedAt: granted ? null : new Date(),
          ipAddress,
          userAgent,
        },
      });
    }

    return this.prisma.consentRecord.create({
      data: {
        userId,
        consentType: consentType as any,
        version,
        granted,
        ipAddress,
        userAgent,
      },
    });
  }

  // ─── Revoke Consent ─────────────────────────────────────────────────────

  async revokeConsent(userId: string, consentType: string) {
    const consentDef = CONSENT_TYPES.find((c) => c.type === consentType);
    if (!consentDef) {
      throw new BadRequestException(`Unknown consent type: ${consentType}`);
    }

    if (!consentDef.revocable) {
      throw new BadRequestException(`Cannot revoke required consent: ${consentType}`);
    }

    const activeConsent = await this.prisma.consentRecord.findFirst({
      where: {
        userId,
        consentType: consentType as any,
        revokedAt: null,
      },
    });

    if (!activeConsent) {
      throw new NotFoundException('No active consent found for this type');
    }

    await this.prisma.consentRecord.update({
      where: { id: activeConsent.id },
      data: { revokedAt: new Date() },
    });

    return { consentType, revokedAt: new Date() };
  }

  // ─── Get User Consents ──────────────────────────────────────────────────

  async getUserConsents(userId: string) {
    const records = await this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Group by consent type, return latest state
    const consentMap = new Map<string, any>();
    for (const record of records) {
      if (!consentMap.has(record.consentType)) {
        consentMap.set(record.consentType, {
          type: record.consentType,
          version: record.version,
          granted: record.granted,
          createdAt: record.createdAt,
          revokedAt: record.revokedAt,
          isActive: record.granted && !record.revokedAt,
        });
      }
    }

    // Add consent types that haven't been granted yet
    for (const consentDef of CONSENT_TYPES) {
      if (!consentMap.has(consentDef.type)) {
        consentMap.set(consentDef.type, {
          type: consentDef.type,
          version: null,
          granted: false,
          createdAt: null,
          revokedAt: null,
          isActive: false,
        });
      }
    }

    return Array.from(consentMap.values());
  }

  // ─── Check Policy Consent ───────────────────────────────────────────────

  /**
   * Check if user has consented to the latest versions of required policies.
   */
  async checkPolicyConsent(userId: string) {
    const latestTerms = await this.prisma.policyVersion.findFirst({
      where: { policyType: 'terms_of_service' },
      orderBy: { effectiveDate: 'desc' },
    });

    const latestPrivacy = await this.prisma.policyVersion.findFirst({
      where: { policyType: 'privacy_policy' },
      orderBy: { effectiveDate: 'desc' },
    });

    const userConsents = await this.prisma.consentRecord.findMany({
      where: {
        userId,
        revokedAt: null,
        granted: true,
      },
    });

    const missingConsents: string[] = [];

    if (latestTerms) {
      const hasTerms = userConsents.some(
        (c) => c.consentType === 'terms_of_service' && c.version === latestTerms.version,
      );
      if (!hasTerms) missingConsents.push('terms_of_service');
    }

    if (latestPrivacy) {
      const hasPrivacy = userConsents.some(
        (c) => c.consentType === 'privacy_policy' && c.version === latestPrivacy.version,
      );
      if (!hasPrivacy) missingConsents.push('privacy_policy');
    }

    return {
      isComplete: missingConsents.length === 0,
      missingConsents,
      latestVersions: {
        terms_of_service: latestTerms?.version ?? null,
        privacy_policy: latestPrivacy?.version ?? null,
      },
    };
  }

  // ─── Policy Version Management ──────────────────────────────────────────

  async createPolicyVersion(
    policyType: string,
    version: string,
    effectiveDate: Date,
    contentUrl: string,
    requiresConsent: boolean = true,
  ) {
    return this.prisma.policyVersion.create({
      data: {
        policyType,
        version,
        effectiveDate,
        contentUrl,
        requiresConsent,
      },
    });
  }

  async getLatestPolicyVersion(policyType: string) {
    return this.prisma.policyVersion.findFirst({
      where: { policyType },
      orderBy: { effectiveDate: 'desc' },
    });
  }

  async getAllPolicyVersions(policyType?: string) {
    const where = policyType ? { policyType } : {};
    return this.prisma.policyVersion.findMany({
      where,
      orderBy: { effectiveDate: 'desc' },
    });
  }

  // ─── Get Consent Types ──────────────────────────────────────────────────

  getConsentTypes() {
    return CONSENT_TYPES;
  }
}
