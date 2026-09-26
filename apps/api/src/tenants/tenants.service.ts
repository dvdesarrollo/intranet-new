import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PermissionAction, PermissionResource, SystemRole } from '@intranet/database';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';

// Roles por defecto que se provisionan para cada empresa nueva. Los
// permisos concretos siguen la misma matriz usada en prisma/seed.ts.
const DEFAULT_TENANT_ROLES: SystemRole[] = [
  SystemRole.TENANT_ADMIN,
  SystemRole.HR,
  SystemRole.MANAGER,
  SystemRole.APPROVER,
  SystemRole.EMPLOYEE,
];

/**
 * Operaciones de plataforma (SUPER_ADMIN), fuera del scoping automático de
 * `PrismaService.client` porque, por definición, operan ANTES de que exista
 * o A TRAVÉS de un tenant específico. Usa siempre `prisma.raw` y filtra
 * `tenantId` manualmente.
 */
@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.raw.tenant.findMany({ include: { branding: true } });
  }

  async createTenant(dto: CreateTenantDto) {
    const existing = await this.prisma.raw.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`El slug '${dto.slug}' ya está en uso`);

    return this.prisma.raw.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.name, slug: dto.slug, ruc: dto.ruc, domain: dto.domain },
      });

      await tx.tenantBranding.create({ data: { tenantId: tenant.id } });

      const roleIds = new Map<SystemRole, string>();
      for (const roleName of DEFAULT_TENANT_ROLES) {
        const role = await tx.role.create({
          data: { tenantId: tenant.id, name: roleName, label: roleName },
        });
        roleIds.set(roleName, role.id);
      }

      // Permisos base del TENANT_ADMIN recién creado (administración total
      // de su propia empresa; ver matriz completa en prisma/seed.ts).
      const adminPermissions: [PermissionResource, PermissionAction][] = [
        [PermissionResource.TENANT_SETTINGS, PermissionAction.MANAGE],
        [PermissionResource.EMPLOYEE_PROFILE, PermissionAction.MANAGE],
        [PermissionResource.DOCUMENT, PermissionAction.MANAGE],
        [PermissionResource.NOTIFICATION, PermissionAction.WRITE],
      ];
      for (const [resource, action] of adminPermissions) {
        const permission = await tx.permission.upsert({
          where: { resource_action: { resource, action } },
          update: {},
          create: { resource, action },
        });
        await tx.rolePermission.create({
          data: { roleId: roleIds.get(SystemRole.TENANT_ADMIN)!, permissionId: permission.id },
        });
      }

      const passwordHash = await argon2.hash(dto.adminPassword);
      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.adminEmail.toLowerCase(),
          passwordHash,
          mustChangePassword: true,
          roles: { create: { roleId: roleIds.get(SystemRole.TENANT_ADMIN)! } },
        },
      });

      return { tenant, adminUserId: adminUser.id };
    });
  }

  async getBrandingBySlug(slug: string) {
    const tenant = await this.prisma.raw.tenant.findUnique({
      where: { slug },
      include: { branding: true },
    });
    if (!tenant || !tenant.isActive) throw new NotFoundException('Empresa no encontrada');
    return { tenant: { slug: tenant.slug, name: tenant.name }, branding: tenant.branding };
  }

  async updateBranding(tenantId: string, dto: UpdateBrandingDto) {
    return this.prisma.raw.tenantBranding.upsert({
      where: { tenantId },
      update: dto,
      create: { tenantId, ...dto },
    });
  }

  async setActive(tenantId: string, isActive: boolean) {
    return this.prisma.raw.tenant.update({ where: { id: tenantId }, data: { isActive } });
  }
}
