export interface ErpPayslipRecord {
  erpReferenceId: string; // id único e inmutable del recibo en el ERP externo
  erpEmployeeId: string; // debe matchear Employee.erpEmployeeId
  periodMonth: number;
  periodYear: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  currency: string;
  lines: { label: string; amount: number; kind: 'EARNING' | 'DEDUCTION' }[];
}

/**
 * Contrato que debe implementar cada conector de ERP externo
 * (ej. SAP SuccessFactors, Contífico, un ERP propietario del cliente).
 * `TenantsService` resuelve qué implementación usar por tenant según su
 * configuración (`Tenant.erpProvider`, guardado como setting propio).
 */
export interface ErpPayrollClient {
  fetchPayslips(params: {
    periodMonth: number;
    periodYear: number;
  }): Promise<ErpPayslipRecord[]>;
}
