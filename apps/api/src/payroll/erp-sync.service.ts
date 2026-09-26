import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PayrollSyncStatus } from '@intranet/database';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context';
import { ErpPayrollClient } from './erp/erp-payroll-client.interface';

@Injectable()
export class ErpSyncService {
  private readonly logger = new Logger(ErpSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Sincroniza los recibos de un periodo desde el ERP externo.
   * Idempotente: se puede reintentar sin duplicar registros, gracias al
   * índice único `(tenantId, erpReferenceId)` en `Payslip`.
   */
  async syncPeriod(
    erpClient: ErpPayrollClient,
    source: string,
    periodMonth: number,
    periodYear: number,
  ) {
    const ctx = this.prisma.client; // ya viene scopeado al tenant actual
    const { tenantId } = this.tenantContext.getOrThrow();

    const syncLog = await ctx.payrollSyncLog.create({
      data: { tenantId, source, periodMonth, periodYear, status: PayrollSyncStatus.PENDING },
    });

    let recordsOk = 0;
    let recordsFailed = 0;
    const errors: string[] = [];

    try {
      const records = await erpClient.fetchPayslips({ periodMonth, periodYear });

      for (const record of records) {
        try {
          const employee = await ctx.employee.findFirst({
            where: { erpEmployeeId: record.erpEmployeeId },
            select: { id: true },
          });

          if (!employee) {
            throw new NotFoundException(
              `Empleado con erpEmployeeId=${record.erpEmployeeId} no existe en este tenant`,
            );
          }

          await ctx.payslip.upsert({
            where: {
              tenantId_erpReferenceId: { tenantId, erpReferenceId: record.erpReferenceId },
            },
            update: {
              grossSalary: record.grossSalary,
              totalDeductions: record.totalDeductions,
              netSalary: record.netSalary,
              currency: record.currency,
              details: record.lines,
              syncedAt: new Date(),
            },
            create: {
              tenantId,
              employeeId: employee.id,
              erpReferenceId: record.erpReferenceId,
              periodMonth: record.periodMonth,
              periodYear: record.periodYear,
              grossSalary: record.grossSalary,
              totalDeductions: record.totalDeductions,
              netSalary: record.netSalary,
              currency: record.currency,
              details: record.lines,
            },
          });

          recordsOk++;
        } catch (error) {
          recordsFailed++;
          errors.push(`${record.erpReferenceId}: ${(error as Error).message}`);
          this.logger.warn(`Fallo sincronizando payslip ${record.erpReferenceId}: ${error}`);
        }
      }

      await ctx.payrollSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: recordsFailed === 0 ? PayrollSyncStatus.SUCCESS : PayrollSyncStatus.FAILED,
          recordsRead: records.length,
          recordsOk,
          recordsFailed,
          errorLog: errors.length ? errors.join('\n') : null,
          finishedAt: new Date(),
        },
      });

      return { recordsOk, recordsFailed, syncLogId: syncLog.id };
    } catch (error) {
      await ctx.payrollSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: PayrollSyncStatus.FAILED,
          errorLog: (error as Error).message,
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }
}
