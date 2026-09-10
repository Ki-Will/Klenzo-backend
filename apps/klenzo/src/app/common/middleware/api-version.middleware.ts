import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * API versioning middleware.
 * Supports URL-based versioning (/api/v1/...) and header-based versioning.
 *
 * Usage:
 *   /api/v1/auth/login  →  version 1
 *   /api/v2/auth/login  →  version 2
 *   X-API-Version: v1   →  version 1 (header)
 */
@Injectable()
export class ApiVersionMiddleware implements NestMiddleware {
  private readonly supportedVersions = ['v1', 'v2'];
  private readonly defaultVersion = 'v1';

  use(req: Request, res: Response, next: NextFunction) {
    // Extract version from URL
    const urlVersion = this.extractVersionFromUrl(req.url);

    // Extract version from header
    const headerVersion = req.headers['x-api-version'] as string;

    // Use header version first, then URL version, then default
    const version = headerVersion || urlVersion || this.defaultVersion;

    // Validate version
    if (!this.supportedVersions.includes(version)) {
      res.status(400).json({
        statusCode: 400,
        message: `API version '${version}' is not supported. Supported versions: ${this.supportedVersions.join(', ')}`,
        supportedVersions: this.supportedVersions,
      });
      return;
    }

    // Attach version to request for downstream use
    (req as any).apiVersion = version;

    // Set response header
    res.setHeader('X-API-Version', version);

    next();
  }

  private extractVersionFromUrl(url: string): string | null {
    const match = url.match(/^\/api\/(v\d+)\//);
    return match ? match[1] : null;
  }
}
