import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollSyncController } from './payroll-sync.controller';
import { PayrollService } from './payroll.service';
import { PdfWatermarkService } from './pdf-watermark.service';
import { ErpSyncService } from './erp-sync.service';

@Module({
  controllers: [PayrollController, PayrollSyncController],
  providers: [PayrollService, PdfWatermarkService, ErpSyncService],
})
export class PayrollModule {}
