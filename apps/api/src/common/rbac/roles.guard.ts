import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '@intranet/database';
import { ROLES_KEY } from './roles.decorator';

/**
 * Autoriza por rol. Se ejecuta después de `JwtAuthGuard`, que ya dejó
 * `request.user = { id, roles: SystemRole[] }` cargado desde el JWT.
 * Si el endpoint no declara `@Roles(...)`, se permite el acceso a
 * cualquier usuario autenticado del tenant.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const userRoles: SystemRole[] = user?.roles ?? [];

    const authorized =
      userRoles.includes(SystemRole.SUPER_ADMIN) ||
      requiredRoles.some((role) => userRoles.includes(role));

    if (!authorized) {
      throw new ForbiddenException(
        `Requiere uno de los roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
