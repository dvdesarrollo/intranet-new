import { Injectable } from '@nestjs/common';
import { RequestType, SystemRole } from '@intranet/database';

/**
 * Define, por tipo de solicitud, la cadena de roles que deben aprobar en
 * orden. `MANAGER` siempre se resuelve como el jefe directo del empleado
 * (`Employee.managerId`); el resto de roles (HR, TENANT_ADMIN) se resuelve
 * contra cualquier usuario del tenant que tenga ese rol asignado.
 */
const APPROVAL_CHAINS: Record<RequestType, SystemRole[]> = {
  [RequestType.PERMISSION]: [SystemRole.MANAGER],
  [RequestType.VACATION]: [SystemRole.MANAGER, SystemRole.HR],
  [RequestType.LOAN]: [SystemRole.MANAGER, SystemRole.HR],
};

@Injectable()
export class ApprovalWorkflowService {
  getChain(type: RequestType): SystemRole[] {
    return APPROVAL_CHAINS[type];
  }
}
