import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@intranet/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import { TenantsService } from './tenants.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';

/**
 * Auto-servicio de branding: cada empresa (rol TENANT_ADMIN) configura su
 * propio logo y colores corporativos, sin necesidad de un SUPER_ADMIN.
 * Esta ruta SÍ pasa por `TenantMiddleware` (no está bajo `platform/`), por
 * lo que `tenant.id` ya viene resuelto por subdominio/host.
 */
@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenant-settings')
export class TenantSettingsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('branding')
  getBranding(@CurrentTenant() tenant: { id: string; slug: string }) {
    return this.tenantsService.getBrandingBySlug(tenant.slug);
  }

  @Patch('branding')
  @Roles(SystemRole.TENANT_ADMIN)
  updateBranding(
    @CurrentTenant() tenant: { id: string; slug: string },
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.tenantsService.updateBranding(tenant.id, dto);
  }
}
