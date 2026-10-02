import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import * as argon2 from 'argon2';
import {
  PermissionAction,
  PermissionResource,
  SystemRole,
} from '@prisma/client';
import { createPrismaClient } from '../src/client';

loadEnv({ path: path.join(__dirname, '..', '.env') });

const prisma = createPrismaClient();

// Credenciales de la empresa demo (ver seedDemoTenant). Pensadas solo para
// desarrollo local; en producción el primer TENANT_ADMIN se crea desde
// POST /platform/tenants con una contraseña real.
const DEMO_PASSWORD = 'Demo1234!';

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
  // No se puede usar upsert con la clave compuesta `@@unique([tenantId, name])`
  // cuando tenantId es null: Prisma rechaza un `null` dentro de un filtro de
  // clave única compuesta. Se busca/crea manualmente en su lugar.
  const superAdminRole =
    (await prisma.role.findFirst({ where: { tenantId: null, name: SystemRole.SUPER_ADMIN } })) ??
    (await prisma.role.create({
      data: { tenantId: null, name: SystemRole.SUPER_ADMIN, label: 'Super Administrador' },
    }));

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

  await seedDemoTenant();
}

/**
 * Empresa demo para desarrollo/pruebas: crea el tenant "dvnet" con su
 * branding, una ciudad/departamento/oficina (para probar la validación
 * geoespacial de marcación) y tres usuarios que cubren la jerarquía de
 * aprobación (admin, jefe, empleado a su cargo).
 */
async function seedDemoTenant() {
  const slug = 'dvnet';

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    console.log(`Tenant demo '${slug}' ya existe, se omite.`);
    return;
  }

  console.log(`Creando empresa demo '${slug}'...`);
  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { slug, name: 'DVNet', ruc: '1790000000001' },
    });

    await tx.tenantBranding.create({
      data: {
        tenantId: tenant.id,
        primaryColor: '#0F172A',
        secondaryColor: '#2563EB',
        accentColor: '#F59E0B',
      },
    });

    const city = await tx.city.create({ data: { tenantId: tenant.id, name: 'Quito' } });
    const department = await tx.department.create({
      data: { tenantId: tenant.id, name: 'Tecnología', cityId: city.id },
    });

    // Radio permitido de 150m alrededor de la oficina matriz; usado por
    // AttendanceService para validar (o rechazar) cada marcación.
    await tx.officeLocation.create({
      data: {
        tenantId: tenant.id,
        name: 'Oficina Matriz Quito',
        cityId: city.id,
        latitude: -0.1807,
        longitude: -78.4678,
        radiusMeters: 150,
      },
    });

    const roleIds = new Map<SystemRole, string>();
    for (const roleName of [
      SystemRole.TENANT_ADMIN,
      SystemRole.HR,
      SystemRole.MANAGER,
      SystemRole.APPROVER,
      SystemRole.EMPLOYEE,
    ] as const) {
      const role = await tx.role.create({
        data: { tenantId: tenant.id, name: roleName, label: roleName },
      });
      roleIds.set(roleName, role.id);

      for (const [resource, action] of ROLE_PERMISSIONS[roleName]) {
        const permission = await tx.permission.upsert({
          where: { resource_action: { resource, action } },
          update: {},
          create: { resource, action },
        });
        await tx.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        });
      }
    }

    const adminUser = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: 'admin@dvnet.com',
        passwordHash,
        roles: { create: { roleId: roleIds.get(SystemRole.TENANT_ADMIN)! } },
      },
    });
    await tx.employee.create({
      data: {
        tenantId: tenant.id,
        userId: adminUser.id,
        employeeCode: 'DVN-0000',
        firstName: 'Admin',
        lastName: 'DVNet',
        documentId: '1700000000',
        position: 'Administrador',
        departmentId: department.id,
        cityId: city.id,
        hireDate: new Date('2021-01-01'),
      },
    });

    const managerUser = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: 'jefe@dvnet.com',
        passwordHash,
        roles: { create: { roleId: roleIds.get(SystemRole.MANAGER)! } },
      },
    });
    const managerEmployee = await tx.employee.create({
      data: {
        tenantId: tenant.id,
        userId: managerUser.id,
        employeeCode: 'DVN-0001',
        firstName: 'María',
        lastName: 'Jefe',
        documentId: '1700000001',
        position: 'Gerente de Tecnología',
        departmentId: department.id,
        cityId: city.id,
        hireDate: new Date('2022-01-10'),
      },
    });

    const employeeUser = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: 'empleado@dvnet.com',
        passwordHash,
        roles: { create: { roleId: roleIds.get(SystemRole.EMPLOYEE)! } },
      },
    });
    await tx.employee.create({
      data: {
        tenantId: tenant.id,
        userId: employeeUser.id,
        employeeCode: 'DVN-0002',
        firstName: 'Juan',
        lastName: 'Empleado',
        documentId: '1700000002',
        position: 'Desarrollador',
        departmentId: department.id,
        cityId: city.id,
        managerId: managerEmployee.id,
        hireDate: new Date('2023-03-01'),
      },
    });
  });

  console.log('Empresa demo creada: tenant "dvnet"');
  console.log(`  admin@dvnet.com    (TENANT_ADMIN)  / ${DEMO_PASSWORD}`);
  console.log(`  jefe@dvnet.com     (MANAGER)        / ${DEMO_PASSWORD}`);
  console.log(`  empleado@dvnet.com (EMPLOYEE, reporta a jefe@dvnet.com) / ${DEMO_PASSWORD}`);
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
