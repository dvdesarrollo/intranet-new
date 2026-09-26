import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SystemRole } from '@intranet/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { ErpSyncService } from './erp-sync.service';
import { HttpErpPayrollClient } from './erp/http-erp-payroll.client';
import { SyncPayrollDto } from './dto/sync-payroll.dto';

/**
 * Disparo manual/administrativo de la sincronización de nómina desde el ERP
 * externo. En producción esto normalmente corre además como job programado
 * (`@nestjs/schedule`, ver `PayrollModule`), pero se expone también aquí
 * para permitir re-sincronizar un periodo puntual (ej. tras corregir datos
 * en el ERP).
 */
@ApiTags('payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payroll/sync')
export class PayrollSyncController {
  constructor(
    private readonly erpSyncService: ErpSyncService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @Roles(SystemRole.TENANT_ADMIN, SystemRole.HR)
  async sync(@Body() dto: SyncPayrollDto) {
    // TODO: resolver el conector correcto (baseUrl/apiKey) por tenant desde
    // una tabla de configuración de integraciones en lugar de variables de
    // entorno globales, cuando existan múltiples proveedores de ERP.
    const client = new HttpErpPayrollClient(
      this.config.getOrThrow('ERP_BASE_URL'),
      this.config.getOrThrow('ERP_API_KEY'),
    );

    return this.erpSyncService.syncPeriod(client, 'default-erp', dto.periodMonth, dto.periodYear);
  }
}
