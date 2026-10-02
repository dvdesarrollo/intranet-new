import {
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { TenantContextService } from './tenant-context';
import { TenantMiddleware } from './tenant.middleware';

@Global()
@Module({
  providers: [TenantContextService],
  exports: [TenantContextService],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Nest aplica el prefijo global ('api/v1', ver main.ts) automáticamente
    // a estos paths de middleware — NO hay que repetirlo aquí (ponerlo
    // duplicaría a "api/v1/api/v1/...” y el exclude nunca matchearía).
    consumer
      .apply(TenantMiddleware)
      .exclude(
        // Rutas de plataforma (SUPER_ADMIN) no pertenecen a ningún tenant.
        { path: 'platform/*path', method: RequestMethod.ALL },
        { path: 'docs', method: RequestMethod.ALL },
      )
      // El resto, INCLUYENDO /api/v1/auth/login, sí pasa por aquí: el login
      // de un empleado necesita saber a qué empresa pertenece (resuelta por
      // subdominio/host o header `X-Tenant-Slug`) antes de poder validar
      // sus credenciales contra el `User` correcto.
      .forRoutes('*path');
  }
}
