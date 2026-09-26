import { Injectable } from '@nestjs/common';
import { ErpPayrollClient, ErpPayslipRecord } from './erp-payroll-client.interface';

/**
 * Implementación de referencia: consume un ERP externo vía REST.
 * Cada tenant puede requerir su propio conector (SAP, Contífico, etc.);
 * este cliente sirve de plantilla para esos casos concretos.
 */
@Injectable()
export class HttpErpPayrollClient implements ErpPayrollClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async fetchPayslips(params: {
    periodMonth: number;
    periodYear: number;
  }): Promise<ErpPayslipRecord[]> {
    const url = `${this.baseUrl}/payroll/${params.periodYear}/${params.periodMonth}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`ERP respondió ${response.status}: ${await response.text()}`);
    }

    return (await response.json()) as ErpPayslipRecord[];
  }
}
