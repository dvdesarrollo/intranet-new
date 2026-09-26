import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SuperAdminGuard } from '../common/rbac/super-admin.guard';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';

/**
 * Panel de administración GLOBAL de la plataforma: alta de empresas y
 * configuración de su branding. Montado fuera del scoping de tenant
 * (ver AppModule -> RouterModule con prefix 'platform').
 */
@ApiTags('tenants')
@Controller('platform/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(SuperAdminGuard)
  list() {
    return this.tenantsService.list();
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(SuperAdminGuard)
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.createTenant(dto);
  }

  @Patch(':tenantId/branding')
  @ApiBearerAuth()
  @UseGuards(SuperAdminGuard)
  updateBranding(@Param('tenantId') tenantId: string, @Body() dto: UpdateBrandingDto) {
    return this.tenantsService.updateBranding(tenantId, dto);
  }

  @Patch(':tenantId/status')
  @ApiBearerAuth()
  @UseGuards(SuperAdminGuard)
  setActive(@Param('tenantId') tenantId: string, @Body('isActive') isActive: boolean) {
    return this.tenantsService.setActive(tenantId, isActive);
  }

  /**
   * Endpoint PÚBLICO (sin auth): Astro lo consulta en el SSR de cada
   * página para pintar logo/colores antes de que el usuario inicie sesión.
   * No expone datos sensibles, solo branding.
   */
  @Get(':slug/branding')
  getPublicBranding(@Param('slug') slug: string) {
    return this.tenantsService.getBrandingBySlug(slug);
  }
}
