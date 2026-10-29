import { getErrorReason } from './error-reason';
import { Injectable, Logger, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, concatMap, map } from 'rxjs/operators';
import { PrismaService } from '../../prisma.service';

type AuditRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  socket?: { remoteAddress?: string };
  user?: { sub?: string; username?: string; fullName?: string };
  body?: unknown;
  get?: (name: string) => string | undefined;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuditRequest>();
    const response = http.getResponse<{ statusCode?: number }>();
    const method = String(request.method || '').toUpperCase();

    // Read-only requests create too much noise. Login and audit endpoints already
    // have dedicated handling and must not recursively create audit entries.
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next.handle();

    const path = String(request.originalUrl || request.url || '').split('?')[0].slice(0, 500);
    if (path.endsWith('/auth/login') || /\/auth\/me\/(profile|change-password)\/?$/i.test(path) || path.includes('/audit')) return next.handle();

    // A row-color change already has its own transactional change_color event.
    // Avoid adding a second generic API event for that same operation.
    const skipSuccessfulRequest = (
      /\/stores\/[^/]+$/i.test(path) &&
      request.body !== null &&
      typeof request.body === 'object' &&
      Object.prototype.hasOwnProperty.call(request.body, 'rowColor')
    );

    const actorId = request.user?.sub;
    if (!actorId) return next.handle();

    const actorName = String(request.user?.username || request.user?.fullName || 'Пользователь').slice(0, 120);
    const ip = String(request.ip || request.socket?.remoteAddress || '').slice(0, 100);
    const userAgent = String(request.get?.('user-agent') || '').slice(0, 300);
    const payload = this.sanitizePayload(request.body);

    return next.handle().pipe(
      // Persist the audit event before the HTTP response completes. The writer
      // catches its own errors so an audit outage does not mask the business result.
      concatMap((result) => skipSuccessfulRequest ? of(result) : from(this.record({
        actorId, actorName, method, path, ip, userAgent, payload, statusCode: response.statusCode || 200,
      })).pipe(map(() => result))),
      catchError((error: any) => {
        const statusCode = typeof error?.getStatus === 'function' ? error.getStatus() : 500;
        return from(this.record({ actorId, actorName, method, path, ip, userAgent, payload, statusCode, errorReason: getErrorReason(error, request.body) })).pipe(
          concatMap(() => throwError(() => error)),
        );
      }),
    );
  }

  private sanitizePayload(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) return undefined;
    if (depth > 3) return '[TRUNCATED]';
    if (typeof value === 'string') return value.slice(0, 300);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 20).map(item => this.sanitizePayload(item, depth + 1));
    if (typeof value !== 'object') return String(value).slice(0, 100);
    const safe: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      safe[key] = /proxyUrl|password|secret|token|(?:api|legacy|encryption).?key|authorization|cookie|credential/i.test(key)
        ? '[REDACTED]'
        : this.sanitizePayload(item, depth + 1);
    }
    return safe;
  }

  private async record(entry: {
    actorId: string;
    actorName: string;
    method: string;
    path: string;
    ip: string;
    userAgent: string;
    payload: unknown;
    statusCode: number;
    errorReason?: string;
  }) {
    try {
      const details = { outcome: entry.statusCode < 400 ? 'success' : 'error', statusCode: entry.statusCode, errorReason: entry.errorReason, ip: entry.ip, userAgent: entry.userAgent, payload: entry.payload };
      if (JSON.stringify(details).length > 4000) details.payload = '[TRUNCATED]';
      await this.prisma.auditLog.create({
        data: {
          userId: entry.actorId,
          action: 'api_request',
          field: 'http_request',
          newValue: `${entry.method} ${entry.path}`.slice(0, 1000),
          details: JSON.stringify(details),
        },
      });
    } catch (error: any) {
      this.logger.error(`Could not append audit record: ${error?.message || error}`);
    }
  }
}
