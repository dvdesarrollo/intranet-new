import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SystemRole } from '@intranet/database';

/**
 * Guard para las rutas de plataforma (`/api/v1/platform/**`), que no
 * pertenecen a ningún tenant y por tanto NO pasan por `TenantMiddleware`.
 * A diferencia de `JwtAuthGuard`, no valida coincidencia con `request.tenant`
 * (no existe); sólo exige un JWT válido con rol SUPER_ADMIN.
 */
@Injectable()
export class SuperAdminGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext): TUser {
    const authUser = super.handleRequest(err, user, info, context);
    const roles: SystemRole[] = (authUser as any).roles ?? [];

    if (!roles.includes(SystemRole.SUPER_ADMIN)) {
      throw new ForbiddenException('Requiere rol SUPER_ADMIN de plataforma');
    }

    return authUser;
  }
}
