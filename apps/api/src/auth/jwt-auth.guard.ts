import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantContextService } from '../common/tenant/tenant-context';

/**
 * Extiende el guard estándar de Passport-JWT para además:
 *  1. Verificar que el tenant del token coincide con el tenant resuelto por
 *     `TenantMiddleware` a partir del subdominio/host de la petición
 *     (evita usar un token de la Empresa A contra el subdominio de la
 *     Empresa B).
 *  2. Completar el `TenantContextService` con userId/roles, para que
 *     `PrismaService` y las reglas de negocio los tengan disponibles.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly tenantContext: TenantContextService) {
    super();
  }

  handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext): TUser {
    const user2 = super.handleRequest(err, user, info, context);
    const request = context.switchToHttp().getRequest();

    if (!request.tenant || request.tenant.id !== (user2 as any).tenantId) {
      throw new ForbiddenException('El token no corresponde a esta empresa');
    }

    request.user = user2;
    this.tenantContext.patch({
      userId: (user2 as any).id,
      roles: (user2 as any).roles,
    });

    return user2;
  }
}
