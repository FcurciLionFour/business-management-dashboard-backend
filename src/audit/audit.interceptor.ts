import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request>();

    const method = req.method;
    const path = req.originalUrl ?? req.url;

    const shouldLog = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!shouldLog) {
      return next.handle();
    }

    const actorUserId = req.user?.sub;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    const requestIdHeader = req.headers['x-request-id'];
    const requestId =
      typeof requestIdHeader === 'string'
        ? requestIdHeader
        : Array.isArray(requestIdHeader)
          ? requestIdHeader[0]
          : undefined;

    return next.handle().pipe(
      tap({
        next: () => {
          void this.audit.log({
            actorUserId,
            action: `${method} ${path}`,
            method,
            path,
            ip,
            userAgent,
            statusCode: 200,
            requestId,
          });
        },
        error: (err: unknown) => {
          const statusCode =
            typeof err === 'object' &&
            err !== null &&
            'status' in err &&
            typeof (err as { status?: unknown }).status === 'number'
              ? (err as { status: number }).status
              : 500;

          const message =
            typeof err === 'object' &&
            err !== null &&
            'message' in err &&
            typeof (err as { message?: unknown }).message === 'string'
              ? (err as { message: string }).message
              : 'Unknown error';

          void this.audit.log({
            actorUserId,
            action: `${method} ${path}`,
            method,
            path,
            ip,
            userAgent,
            statusCode,
            requestId,
            metadata: { error: message },
          });
        },
      }),
    );
  }
}
