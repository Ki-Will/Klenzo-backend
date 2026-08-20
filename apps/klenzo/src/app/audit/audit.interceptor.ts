import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from './audit-log.service';
import { UserPayload } from '../auth/jwt.strategy';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, ip, user } = request;

    // Only log mutating methods (POST, PUT, PATCH, DELETE) to keep audit logs clean
    if (method === 'GET') {
      return next.handle();
    }

    const className = context.getClass().name;
    const handlerName = context.getHandler().name;
    const action = `${className}.${handlerName}`;

    // Clean sensitive data from metadata
    const sanitizedBody = { ...body };
    const sensitiveKeys = ['password', 'token', 'accessToken', 'refreshToken', 'oldPassword', 'newPassword'];
    for (const key of sensitiveKeys) {
      if (key in sanitizedBody) {
        sanitizedBody[key] = '[REDACTED]';
      }
    }

    const metadata = {
      body: sanitizedBody,
      query,
    };

    return next.handle().pipe(
      tap({
        next: (responseBody: unknown) => {
          // Fire-and-forget: Save audit log on success
          const actorUser = user as UserPayload | undefined;
          const actorId = actorUser?.id || null;
          const actorRole = actorUser?.role || (actorId ? 'user' : 'system');

          // Extract target information if possible (e.g. from route params)
          const targetType = className.replace('Controller', '').toLowerCase();
          const targetId = request.params?.id || (responseBody as Record<string, unknown>)?.id || null;

          this.auditLogService.create({
            actorId,
            actorRole: String(actorRole),
            action,
            targetType,
            targetId: targetId ? String(targetId) : null,
            metadata,
            ipAddress: ip || null,
            requestPath: url,
          }).catch((err) => {
            console.error('AuditInterceptor failed to write log:', err);
          });
        },
        error: (err: Error) => {
          // Optionally we can log failed actions as well
          const actorUser = user as UserPayload | undefined;
          const actorId = actorUser?.id || null;
          const actorRole = actorUser?.role || (actorId ? 'user' : 'system');
          
          this.auditLogService.create({
            actorId,
            actorRole: String(actorRole),
            action: `${action}.failed`,
            targetType: className.replace('Controller', '').toLowerCase(),
            targetId: request.params?.id || null,
            metadata: {
              ...metadata,
              error: err.message || String(err),
            },
            ipAddress: ip || null,
            requestPath: url,
          }).catch((dbErr) => {
            console.error('AuditInterceptor failed to write error log:', dbErr);
          });
        }
      })
    );
  }
}
