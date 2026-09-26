import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrismaClient, PrismaClient } from '@intranet/database';
import { TenantContextService } from '../tenant/tenant-context';
import { tenantScopingExtension } from './tenant-scoping.extension';

/**
 * Cliente Prisma inyectable. Expone dos superficies:
 *  - `prisma.raw`   -> cliente SIN scoping, para el módulo `tenants`
 *                      (plataforma / SUPER_ADMIN) y para el resolver del
 *                      propio TenantMiddleware (que aún no tiene tenantId).
 *  - `prisma.<...>` -> proxy con tenant-scoping automático vía Prisma
 *                      Client Extension, para todos los demás módulos.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public readonly raw: PrismaClient;
  private readonly scopedClient: ReturnType<ReturnType<typeof tenantScopingExtension>>;

  constructor(
    private readonly config: ConfigService,
    private readonly tenantContext: TenantContextService,
  ) {
    this.raw = createPrismaClient(this.config.get<string>('DATABASE_URL'));
    this.scopedClient = tenantScopingExtension(this.tenantContext)(this.raw);
  }

  async onModuleInit() {
    await this.raw.$connect();
  }

  async onModuleDestroy() {
    await this.raw.$disconnect();
  }

  /** Cliente con tenant-scoping automático; úsalo desde los servicios de negocio. */
  get client() {
    return this.scopedClient;
  }
}
