import {
  PermissionAction,
  PermissionResource,
  SystemRole,
} from '@prisma/client';
import { createPrismaClient } from '../src/client';

const prisma = createPrismaClient();

// Catálogo estandarizado de bancos, compartido entre todos los tenants.
// Ejemplo genérico: reemplazar/ampliar con el catálogo real del país de operación.
const BANKS = [
  { code: '0001', name: 'Banco Nacional' },
  { code: '0002', name: 'Banco Pichincha' },
  { code: '0003', name: 'Banco de Guayaquil' },
  { code: '0004', name: 'Produbanco' },
  { code: '0005', name: 'Banco del Pacífico' },
  { code: '0006', name: 'Cooperativa JEP' },
];

// Matriz de permisos por defecto para cada rol del sistema.
const ROLE_PERMISSIONS: Record<SystemRole, [PermissionResource, PermissionAction][]> = {
  SUPER_ADMIN: Object.values(PermissionResource).flatMap((resource) =>
    Object.values(PermissionAction).map((action) => [resource, action] as const),
  ),
  TENANT_ADMIN: [
    [PermissionResource.TENANT_SETTINGS, PermissionAction.MANAGE],
    [PermissionResource.EMPLOYEE_PROFILE, PermissionAction.MANAGE],
    [PermissionResource.DOCUMENT, PermissionAction.MANAGE],
    [PermissionResource.NOTIFICATION, PermissionAction.WRITE],
    [PermissionResource.PAYROLL, PermissionAction.READ],
    [PermissionResource.ATTENDANCE, PermissionAction.READ],
    [PermissionResource.REQUEST, PermissionAction.READ],
  ],
  HR: [
    [PermissionResource.EMPLOYEE_PROFILE, PermissionAction.MANAGE],
    [PermissionResource.PAYROLL, PermissionAction.MANAGE],
    [PermissionResource.ATTENDANCE, PermissionAction.READ],
    [PermissionResource.REQUEST, PermissionAction.APPROVE],
    [PermissionResource.DOCUMENT, PermissionAction.MANAGE],
  ],
  MANAGER: [
    [PermissionResource.EMPLOYEE_PROFILE, PermissionAction.READ],
    [PermissionResource.ATTENDANCE, PermissionAction.READ],
    [PermissionResource.REQUEST, PermissionAction.APPROVE],
    [PermissionResource.CHANNEL, PermissionAction.MANAGE],
    [PermissionResource.DOCUMENT, PermissionAction.READ],
  ],
  APPROVER: [[PermissionResource.REQUEST, PermissionAction.APPROVE]],
  EMPLOYEE: [
    [PermissionResource.EMPLOYEE_PROFILE, PermissionAction.WRITE],
    [PermissionResource.PAYROLL, PermissionAction.READ],
    [PermissionResource.ATTENDANCE, PermissionAction.WRITE],
    [PermissionResource.REQUEST, PermissionAction.WRITE],
    [PermissionResource.DOCUMENT, PermissionAction.READ],
    [PermissionResource.CHANNEL, PermissionAction.READ],
    [PermissionResource.NOTIFICATION, PermissionAction.READ],
  ],
};

async function main() {
  console.log('Seeding bank catalog...');
  for (const bank of BANKS) {
    await prisma.bankCatalog.upsert({
      where: { code: bank.code },
      update: { name: bank.name },
      create: bank,
    });
  }

  console.log('Seeding global permissions...');
  const permissionRecords = new Map<string, string>();
  for (const resource of Object.values(PermissionResource)) {
    for (const action of Object.values(PermissionAction)) {
      const permission = await prisma.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action },
      });
      permissionRecords.set(`${resource}:${action}`, permission.id);
    }
  }

  console.log('Seeding SUPER_ADMIN global role (tenantId = null)...');
  const superAdminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: null as unknown as string, name: SystemRole.SUPER_ADMIN } },
    update: {},
    create: { tenantId: null, name: SystemRole.SUPER_ADMIN, label: 'Super Administrador' },
  });

  for (const [resource, action] of ROLE_PERMISSIONS.SUPER_ADMIN) {
    const permissionId = permissionRecords.get(`${resource}:${action}`)!;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId },
    });
  }

  console.log('Seed completo. Los roles TENANT_ADMIN/HR/MANAGER/APPROVER/EMPLOYEE');
  console.log('se crean por tenant en el onboarding de cada empresa (ver TenantsService.provisionDefaultRoles).');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { ROLE_PERMISSIONS };
