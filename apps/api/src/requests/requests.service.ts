import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalDecision,
  RequestStatus,
  RequestType,
  SystemRole,
} from '@intranet/database';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { DecideRequestDto } from './dto/decide-request.dto';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly workflow: ApprovalWorkflowService,
  ) {}

  async create(employeeId: string, dto: CreateRequestDto) {
    const chain = this.workflow.getChain(dto.type);

    const details = this.buildDetails(dto);
    const { tenantId } = this.tenantContext.getOrThrow();

    return this.prisma.client.request.create({
      data: {
        tenantId,
        employeeId,
        type: dto.type,
        status: RequestStatus.PENDING,
        currentStep: 1,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        amount: dto.amount,
        details,
        approvalSteps: {
          create: chain.map((role, index) => ({
            stepOrder: index + 1,
            requiredRole: role,
            decision: ApprovalDecision.PENDING,
          })),
        },
      },
      include: { approvalSteps: true },
    });
  }

  async listMine(employeeId: string) {
    return this.prisma.client.request.findMany({
      where: { employeeId },
      include: { approvalSteps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Solicitudes pendientes de acción del usuario autenticado: el paso
   * actual de cada solicitud debe requerir uno de sus roles y, si el rol
   * requerido es MANAGER, el usuario debe ser el jefe directo del
   * empleado solicitante.
   *
   * `ApprovalStep`/`Request` join manual: `Request` sí tiene `tenantId`
   * (scoped automáticamente por la extensión de Prisma), pero el filtro
   * anidado en `request: {...}` no pasa por esa extensión, así que se
   * agrega `tenantId` explícitamente para no filtrar entre empresas.
   */
  async listPendingForApprover(user: AuthenticatedUser) {
    const { tenantId } = this.tenantContext.getOrThrow();

    const isManager = user.roles.includes(SystemRole.MANAGER);
    const otherApproverRoles = user.roles.filter((r) => r !== SystemRole.MANAGER);

    return this.prisma.client.approvalStep.findMany({
      where: {
        decision: ApprovalDecision.PENDING,
        request: {
          tenantId,
          status: RequestStatus.PENDING,
        },
        OR: [
          ...(otherApproverRoles.length
            ? [{ requiredRole: { in: otherApproverRoles } }]
            : []),
          ...(isManager
            ? [
                {
                  requiredRole: SystemRole.MANAGER,
                  request: {
                    tenantId,
                    status: RequestStatus.PENDING,
                    employee: { managerId: user.employeeId },
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        request: { include: { employee: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async decide(user: AuthenticatedUser, requestId: string, dto: DecideRequestDto) {
    const { tenantId } = this.tenantContext.getOrThrow();

    const request = await this.prisma.client.request.findFirst({
      where: { id: requestId },
      include: { approvalSteps: { orderBy: { stepOrder: 'asc' } }, employee: true },
    });

    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('La solicitud ya no está pendiente');
    }

    const currentStep = request.approvalSteps.find((s) => s.stepOrder === request.currentStep);
    if (!currentStep || currentStep.decision !== ApprovalDecision.PENDING) {
      throw new BadRequestException('No hay un paso de aprobación pendiente');
    }

    const authorized = this.canActOnStep(user, currentStep.requiredRole, request.employee.managerId);
    if (!authorized) {
      throw new ForbiddenException('No estás autorizado a decidir sobre esta solicitud');
    }

    await this.prisma.client.approvalStep.update({
      where: { id: currentStep.id },
      data: {
        decision: dto.decision,
        actedById: user.id,
        comments: dto.comments,
        actedAt: new Date(),
      },
    });

    if (dto.decision === ApprovalDecision.REJECTED) {
      return this.prisma.client.request.update({
        where: { id: request.id },
        data: { status: RequestStatus.REJECTED },
      });
    }

    const isLastStep = request.currentStep === request.approvalSteps.length;
    return this.prisma.client.request.update({
      where: { id: request.id },
      data: isLastStep
        ? { status: RequestStatus.APPROVED }
        : { currentStep: request.currentStep + 1 },
    });
  }

  private canActOnStep(
    user: AuthenticatedUser,
    requiredRole: SystemRole,
    employeeManagerId: string | null,
  ): boolean {
    if (!user.roles.includes(requiredRole)) return false;
    if (requiredRole === SystemRole.MANAGER) {
      return employeeManagerId === user.employeeId;
    }
    return true;
  }

  private buildDetails(dto: CreateRequestDto): Record<string, unknown> {
    switch (dto.type) {
      case RequestType.LOAN:
        return { amount: dto.amount, installments: dto.installments, reason: dto.reason };
      case RequestType.VACATION:
      case RequestType.PERMISSION:
        return { startDate: dto.startDate, endDate: dto.endDate, reason: dto.reason, ...dto.extra };
      default:
        return dto.extra ?? {};
    }
  }
}
