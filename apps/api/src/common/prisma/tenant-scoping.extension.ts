/**
 * Prisma Client Extension que inyecta automáticamente `tenantId` en toda
 * operación sobre los modelos que tienen esa columna, usando el valor
 * actual del AsyncLocalStorage (`TenantContextService`).
 *
 * Esto evita el error más común en apps multi-tenant: un desarrollador
 * olvida el `where: { tenantId }` en una query y filtra datos entre
 * empresas. Con esta extensión, ese `where` se agrega siempre, incluso si
 * el código de negocio no lo escribe explícitamente.
 *
 * Limitación conocida: modelos que NO tienen columna `tenantId` propia
 * (p. ej. FamilyMember, BankAccount, ApprovalStep, Message, ChannelMember,
 * NotificationRead, DocumentPermission) se relacionan al tenant de forma
 * transitiva a través de su entidad padre (Employee, Request, Channel...).
 * Para esos modelos, los servicios DEBEN validar explícitamente que la
 * entidad padre pertenece al tenant actual (ver `assertBelongsToTenant`
 * en cada servicio) antes de leer/escribir.
 */
import type { PrismaClient } from '@intranet/database';
import { TenantContextService } from '../tenant/tenant-context';

export const TENANT_SCOPED_MODELS = new Set([
  'User',
  'Department',
  'Employee',
  'OfficeLocation',
  'PayrollSyncLog',
  'Payslip',
  'TimeEntry',
  'Request',
  'Notification',
  'Channel',
  'Document',
  'DocumentFolder',
  'AuditLog',
]);

const WRITE_ONE_OPS = new Set(['create']);
const WRITE_MANY_OPS = new Set(['createMany']);
const WHERE_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

interface AllOperationsArgs {
  model?: string;
  operation: string;
  args: Record<string, unknown>;
  query: (args: unknown) => Promise<unknown>;
}

export function tenantScopingExtension(tenantContext: TenantContextService) {
  return (client: PrismaClient) =>
    client.$extends({
      name: 'tenant-scoping',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: AllOperationsArgs) {
            if (!model || !TENANT_SCOPED_MODELS.has(model)) {
              return query(args);
            }

            const ctx = tenantContext.get();
            if (!ctx) {
              // Fuera de una request HTTP (seed, jobs) se debe usar `raw`.
              return query(args);
            }

            const scopedArgs = args as Record<string, unknown>;

            if (WHERE_OPS.has(operation)) {
              scopedArgs.where = { ...(scopedArgs.where as object), tenantId: ctx.tenantId };
            } else if (WRITE_ONE_OPS.has(operation)) {
              scopedArgs.data = { ...(scopedArgs.data as object), tenantId: ctx.tenantId };
            } else if (WRITE_MANY_OPS.has(operation)) {
              const data = scopedArgs.data as Record<string, unknown>[];
              scopedArgs.data = data.map((row) => ({ ...row, tenantId: ctx.tenantId }));
            } else if (operation === 'upsert') {
              scopedArgs.where = { ...(scopedArgs.where as object), tenantId: ctx.tenantId };
              scopedArgs.create = { ...(scopedArgs.create as object), tenantId: ctx.tenantId };
            }

            return query(scopedArgs);
          },
        },
      },
    });
}
