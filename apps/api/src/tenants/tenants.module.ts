import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantsService } from './tenants.service';

@Module({
  controllers: [TenantsController, TenantSettingsController],
  providers: [TenantsService],
})
export class TenantsModule {}
