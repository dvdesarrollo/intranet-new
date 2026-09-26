import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { SystemRole } from '@intranet/database';

export interface TenantRequestContext {
  tenantId: string;
  tenantSlug: string;
  userId?: string;
  roles?: SystemRole[];
}

/**
 * Contexto por-request basado en AsyncLocalStorage. Se puebla en
 * `TenantMiddleware` (tenant) y en `JwtAuthGuard` (userId/roles), y se lee
 * desde `PrismaService` para forzar el scoping por tenant en cada query,
 * sin tener que pasar `tenantId` manualmente por cada servicio/controlador.
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantRequestContext>();

  run<T>(context: TenantRequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): TenantRequestContext | undefined {
    return this.storage.getStore();
  }

  getOrThrow(): TenantRequestContext {
    const ctx = this.storage.getStore();
    if (!ctx) {
      throw new Error(
        'TenantContext no disponible: ¿la petición pasó por TenantMiddleware?',
      );
    }
    return ctx;
  }

  patch(partial: Partial<TenantRequestContext>) {
    const ctx = this.get();
    if (ctx) Object.assign(ctx, partial);
  }
}
