import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

/**
 * Service used by controllers / guards to persist audit entries.
 * All calls are fire‑and‑forget – errors are logged but never disrupt the main flow.
 */
@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async create(entry: Partial<AuditLog>) {
    try {
      const log = this.auditRepo.create(entry);
      await this.auditRepo.save(log);
    } catch (err) {
      // Swallow errors to avoid breaking the request pipeline, but record to console.
      console.error('Failed to write audit log', err);
    }
  }
}
