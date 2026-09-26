import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PdfWatermarkService } from './pdf-watermark.service';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfWatermarkService,
  ) {}

  /** Rol de pagos en modo SOLO LECTURA del empleado autenticado. */
  async listMyPayslips(employeeId: string) {
    return this.prisma.client.payslip.findMany({
      where: { employeeId },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      select: {
        id: true,
        periodMonth: true,
        periodYear: true,
        grossSalary: true,
        totalDeductions: true,
        netSalary: true,
        currency: true,
        syncedAt: true,
      },
    });
  }

  async generatePayslipPdf(employeeId: string, payslipId: string): Promise<Buffer> {
    const payslip = await this.prisma.client.payslip.findFirst({
      where: { id: payslipId, employeeId },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        tenant: { include: { branding: true } },
      },
    });

    if (!payslip) {
      throw new NotFoundException('Rol de pagos no encontrado');
    }

    // El empleado sólo puede descargar SU PROPIO recibo; se valida arriba
    // con el `where: { employeeId }` ya scopeado al tenant actual.
    const lines = (payslip.details as { label: string; amount: number; kind: 'EARNING' | 'DEDUCTION' }[]) ?? [];

    return this.pdfService.generatePayslipPdf({
      tenantName: payslip.tenant.name,
      employeeFullName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
      employeeCode: payslip.employee.employeeCode,
      periodMonth: payslip.periodMonth,
      periodYear: payslip.periodYear,
      grossSalary: payslip.grossSalary.toString(),
      totalDeductions: payslip.totalDeductions.toString(),
      netSalary: payslip.netSalary.toString(),
      currency: payslip.currency,
      lines: lines.map((l) => ({ ...l, amount: l.amount.toString() })),
    });
  }
}
