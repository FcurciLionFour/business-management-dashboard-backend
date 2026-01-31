import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<any>();

    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    // Si no se requiere nada, dejamos pasar
    if (!requiredRoles.length && !requiredPermissions.length) {
      return true;
    }

    // 🔥 CLAVE: si se requiere algo y no hay usuario => 401
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }

    // Traemos roles + permisos del usuario
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    // 🔥 CLAVE: usuario sin roles => deny-by-default
    if (!userRoles.length) {
      throw new ForbiddenException('User has no roles assigned');
    }

    const roleNames = userRoles.map((ur) => ur.role.name);
    const permissionKeys = new Set(
      userRoles.flatMap((ur) =>
        ur.role.permissions.map((rp) => rp.permission.key),
      ),
    );

    if (
      requiredRoles.length &&
      !requiredRoles.some((r) => roleNames.includes(r))
    ) {
      throw new ForbiddenException('Missing required role');
    }

    if (
      requiredPermissions.length &&
      !requiredPermissions.every((p) => permissionKeys.has(p))
    ) {
      throw new ForbiddenException('Missing required permission');
    }

    return true;
  }
}
