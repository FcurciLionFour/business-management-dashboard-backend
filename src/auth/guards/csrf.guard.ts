import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    const method = req.method.toUpperCase();

    // solo proteger métodos mutativos
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!isMutating) {
      return true;
    }

    const csrfCookie = req.cookies?.['csrf_token'];
    const csrfHeader = req.headers['x-csrf-token'];
    console.log('CSRF cookie:', req.cookies?.['csrf_token']);
    console.log('CSRF header:', req.headers['x-csrf-token']);

    if (!csrfCookie || !csrfHeader) {
      throw new ForbiddenException('CSRF token missing');
    }

    const headerValue =
      typeof csrfHeader === 'string'
        ? csrfHeader
        : Array.isArray(csrfHeader)
          ? csrfHeader[0]
          : undefined;

    if (!headerValue || csrfCookie !== headerValue) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}
