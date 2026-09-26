import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/rbac/roles.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PayrollService } from './payroll.service';

@ApiTags('payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  /** Rol de pagos: SOLO LECTURA, siempre poblado desde el ERP externo. */
  @Get('me')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.payrollService.listMyPayslips(user.employeeId!);
  }

  @Get('me/:payslipId/pdf')
  async downloadPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('payslipId') payslipId: string,
    @Res() res: Response,
  ) {
    const pdf = await this.payrollService.generatePayslipPdf(user.employeeId!, payslipId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="rol-de-pagos-${payslipId}.pdf"`,
    });
    res.send(pdf);
  }
}
