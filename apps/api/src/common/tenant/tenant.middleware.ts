import {
  Injectable,
  NestMiddleware,
  NotFoundException,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from './tenant-context';

declare module 'express' {
  interface Request {
    tenant?: { id: string; slug: string };
  }
}

/**
 * Resuelve la empresa (tenant) de cada petición y abre el AsyncLocalStorage
 * con su contexto antes de que llegue a guards/controladores.
 *
 * Estrategia de resolución (en orden):
 *  1. Header `X-Tenant-Slug` (apps móviles / SSR de Astro que ya conocen el tenant).
 *  2. Subdominio del Host (acme.intranet.app -> slug "acme").
 *  3. Dominio propio configurado en `Tenant.domain` (intranet.acme.com).
 *
 * Rutas de plataforma (`/api/v1/platform/**`, usadas por el SUPER_ADMIN para
 * administrar tenants) están excluidas de este middleware, ver AppModule.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const slug = this.resolveSlug(req);

    if (!slug) {
      throw new NotFoundException('No se pudo determinar la empresa (tenant) de la petición');
    }

    const tenant = await this.prisma.raw.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true, isActive: true },
    });

    if (!tenant || !tenant.isActive) {
      throw new NotFoundException(`Empresa '${slug}' no encontrada o inactiva`);
    }

    req.tenant = { id: tenant.id, slug: tenant.slug };

    this.tenantContext.run({ tenantId: tenant.id, tenantSlug: tenant.slug }, () => {
      next();
    });
  }

  private resolveSlug(req: Request): string | undefined {
    const headerSlug = req.header('x-tenant-slug');
    if (headerSlug) return headerSlug.toLowerCase();

    const host = req.header('host') ?? '';
    const hostname = host.split(':')[0];

    // dominio propio (ej. intranet.acme.com) resuelto por TenantsService en
    // el arranque hacia una tabla de lookup en memoria/caché; simplificado
    // aquí a extraer el primer segmento como slug de subdominio.
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      return parts[0].toLowerCase();
    }

    return undefined;
  }
}
