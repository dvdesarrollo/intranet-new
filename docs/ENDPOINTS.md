# Endpoints principales — API REST

Base URL: `/api/v1`. Documentación interactiva (Swagger) en `/docs`.

Todas las rutas, salvo las marcadas **Público** o bajo `/platform`, requieren:
- Header `X-Tenant-Slug` (o subdominio del `Host`) para resolver la empresa.
- Header `Authorization: Bearer <JWT>` emitido para ESE tenant.

Roles abreviados: `SA`=SUPER_ADMIN, `TA`=TENANT_ADMIN, `HR`, `MGR`=MANAGER,
`APR`=APPROVER, `EMP`=EMPLOYEE (cualquier autenticado si no se indica rol).

---

## Autenticación

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/auth/login` | Público (requiere tenant) | Login por email+password, devuelve JWT |

## Plataforma (SUPER_ADMIN) — fuera de cualquier tenant

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/platform/tenants` | SA | Lista todas las empresas |
| POST | `/platform/tenants` | SA | Crea una empresa nueva (+ admin inicial) |
| PATCH | `/platform/tenants/:tenantId/branding` | SA | Actualiza branding de cualquier empresa |
| PATCH | `/platform/tenants/:tenantId/status` | SA | Activa/desactiva una empresa |
| GET | `/platform/tenants/:slug/branding` | Público | Branding para theming del login (Astro) |

## Configuración de la propia empresa (self-service)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/tenant-settings/branding` | Autenticado | Branding de la empresa actual |
| PATCH | `/tenant-settings/branding` | TA | La empresa configura su logo/colores |

## Empleados / Perfil

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/employees/me` | EMP | Perfil propio completo |
| PATCH | `/employees/me` | EMP | Editar contacto (teléfono, email personal, dirección) |
| GET | `/employees/me/family-members` | EMP | Listar cargas familiares |
| POST | `/employees/me/family-members` | EMP | Agregar carga familiar |
| DELETE | `/employees/me/family-members/:id` | EMP | Eliminar carga familiar |
| GET | `/employees/me/bank-accounts` | EMP | Listar cuentas bancarias |
| POST | `/employees/me/bank-accounts` | EMP | Agregar cuenta bancaria (catálogo estandarizado) |

## Nómina (ERP)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/payroll/me` | EMP | Rol de pagos, **solo lectura** |
| GET | `/payroll/me/:payslipId/pdf` | EMP | Descarga PDF con marca de agua del logo |
| POST | `/payroll/sync` | HR, TA | Dispara sincronización de un periodo desde el ERP externo |

## Marcación / Asistencia

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/attendance/clock` | EMP | Registra marcación (CHECK_IN/BREAK_START/BREAK_END/CHECK_OUT); **rechaza si la geolocalización está fuera del radio permitido** |
| GET | `/attendance/me` | EMP | Historial propio de marcaciones (`?from=&to=`) |

## Solicitudes y aprobaciones

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/requests` | EMP | Crea solicitud (`LOAN` \| `PERMISSION` \| `VACATION`) |
| GET | `/requests/me` | EMP | Mis solicitudes y su estado |
| GET | `/requests/pending-approval` | MGR, HR, APR, TA | Bandeja de aprobación del usuario |
| PATCH | `/requests/:id/decision` | MGR, HR, APR, TA | Aprueba/rechaza el paso actual del flujo |

## Notificaciones

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/notifications` | TA, HR, MGR | Crea notificación (`COMPANY`\|`DEPARTMENT`\|`CITY`\|`INDIVIDUAL`) |
| GET | `/notifications/me` | EMP | Bandeja segmentada del usuario |
| PATCH | `/notifications/:id/read` | EMP | Marca como leída |

## Comunicación interna

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/channels` | MGR, TA | Crea canal Jefe-Equipo o Jefe-Gerente |
| GET | `/channels/me` | EMP | Canales donde participo |
| GET | `/channels/:id/messages` | EMP (miembro) | Historial de mensajes |
| POST | `/channels/:id/messages` | EMP (miembro) | Enviar mensaje |

## Gestión documental

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/documents/folders` | TA, HR | Crear carpeta |
| POST | `/documents` | TA, HR, MGR | Subir metadatos de documento (archivo ya en storage externo) |
| GET | `/documents?folderId=&departmentId=` | EMP | Listar documentos visibles según RBAC |
| GET | `/documents/:id/download` | EMP (con permiso) | URL de descarga si tiene acceso |

---

## Flujo de marcación (end-to-end)

1. Cliente (Astro) obtiene `navigator.geolocation.getCurrentPosition()`.
2. `POST /attendance/clock` con `{ type, latitude, longitude, accuracyMeters }`.
3. API valida secuencia del día + calcula distancia Haversine a cada
   `OfficeLocation` del tenant.
4. Fuera de radio → `403 Forbidden` (no se persiste). Dentro de radio →
   `201 Created` con el `TimeEntry` guardado.

## Flujo de carga del ERP (nómina)

1. `POST /payroll/sync { periodMonth, periodYear }` (o cron programado).
2. `ErpSyncService` resuelve el conector (`ErpPayrollClient`) configurado
   para el tenant y pide los recibos del periodo.
3. Por cada recibo: matchea `Employee.erpEmployeeId` y hace
   `upsert` de `Payslip` por `(tenantId, erpReferenceId)` — reintentable sin
   duplicar.
4. Se registra el resultado (`recordsOk`/`recordsFailed`/errores) en
   `PayrollSyncLog`.
5. El empleado ve el recibo en `GET /payroll/me` y descarga el PDF con
   marca de agua en `GET /payroll/me/:id/pdf`.

## Flujo de aprobaciones

1. `POST /requests` crea la solicitud + genera su cadena de `ApprovalStep`
   según el tipo (ver `ApprovalWorkflowService`).
2. Cada aprobador ve sus pendientes en `GET /requests/pending-approval`.
3. `PATCH /requests/:id/decision` solo permite decidir sobre el paso
   actual, valida el rol (y jerarquía si es `MANAGER`), y avanza el flujo o
   lo cierra (`APPROVED`/`REJECTED`).
