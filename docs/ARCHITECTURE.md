# Arquitectura — Intranet Multiempresa (Multi-tenant)

Stack: **NestJS 12** (API) + **Astro 7** (frontend SSR) + **PostgreSQL** + **Prisma 7**.

Monorepo (pnpm workspaces):

```
apps/
  api/            # NestJS
  web/            # Astro (SSR)
packages/
  database/       # schema.prisma, prisma.config.ts, cliente Prisma, seed
docs/
  ARCHITECTURE.md
  ENDPOINTS.md
```

---

## 1. Estrategia multi-tenant

**Shared database, shared schema**: una sola base de datos Postgres, con una
columna `tenantId` en cada tabla que pertenece a una empresa (`User`,
`Employee`, `Department`, `Payslip`, `TimeEntry`, `Request`, `Notification`,
`Channel`, `Document`, `DocumentFolder`, `OfficeLocation`,
`PayrollSyncLog`, `AuditLog`).

Se eligió este modelo (en vez de un schema o base de datos por tenant)
porque:

- El número de empresas puede crecer sin límite operativo (no hay que
  aprovisionar infraestructura por cliente).
- Migraciones de Prisma se aplican una sola vez para todos los tenants.
- Reportes y operaciones cross-tenant (panel de plataforma, facturación,
  soporte) son consultas SQL normales, no un fan-out a N bases de datos.

El costo de este modelo es que el aislamiento entre empresas depende
enteramente de que CADA query incluya `tenantId` en su `WHERE`. Este riesgo
se mitiga con dos capas:

### 1.1 Resolución del tenant por request

`apps/api/src/common/tenant/tenant.middleware.ts` corre en cada request y
determina la empresa por (en orden): header `X-Tenant-Slug` → subdominio del
`Host` → dominio propio del cliente. Si no logra resolver un tenant activo,
la request se rechaza con 404 antes de tocar cualquier controlador.

El resultado (`{ tenantId, tenantSlug }`) se guarda en un
`AsyncLocalStorage` (`TenantContextService`), NO en una variable de
instancia de un servicio (que sería compartida entre requests concurrentes
en Node). `JwtAuthGuard` añade después `userId`/`roles` al mismo contexto
una vez que el JWT es validado, y además verifica que el `tenantId` del
token coincida con el tenant resuelto por subdominio: un token emitido para
`acme.intranet.app` no sirve contra `otraempresa.intranet.app`.

### 1.2 Tenant-scoping automático a nivel de Prisma

`common/prisma/tenant-scoping.extension.ts` es una **Prisma Client
Extension** que intercepta toda operación (`$allOperations`) sobre los
modelos que tienen columna `tenantId`, y le inyecta `tenantId` desde el
`TenantContextService` — tanto en el `where` de lecturas/escrituras como en
el `data` de creaciones. `PrismaService.client` expone este cliente
"scopeado"; es el que usan TODOS los servicios de negocio. Además, cada
`create()` en los servicios pasa `tenantId` explícitamente (por claridad y
porque los tipos estáticos de Prisma lo exigen); la extensión actúa como
**red de seguridad en runtime** por si algún desarrollador lo olvida.

`PrismaService.raw` expone el cliente SIN esta extensión, reservado para:
- El propio `TenantMiddleware` (que aún no tiene tenant resuelto).
- El módulo `tenants` (operaciones de plataforma: alta de empresas, listar
  todas las empresas, actualizar cualquier branding desde SUPER_ADMIN).

**Limitación conocida y documentada en el código**: modelos sin columna
`tenantId` propia (`FamilyMember`, `BankAccount`, `ApprovalStep`, `Message`,
`ChannelMember`, `NotificationRead`, `DocumentPermission`) se relacionan al
tenant de forma transitiva a través de su entidad padre (`Employee`,
`Request`, `Channel`, `Document`). Los servicios validan explícitamente que
esa entidad padre pertenece al tenant/usuario actual antes de leer o
escribir (ver p. ej. `EmployeesService.assertFamilyMemberBelongsToEmployee`,
`CommunicationService.assertMember`).

### 1.3 Cuentas de plataforma (SUPER_ADMIN)

El rol `SUPER_ADMIN` administra TODAS las empresas (alta de tenants,
branding, activar/desactivar). Sus rutas viven bajo `/api/v1/platform/**`,
excluidas de `TenantMiddleware` (no pertenecen a un tenant), y protegidas
por `SuperAdminGuard` en lugar de `JwtAuthGuard` (no exige coincidencia de
tenant, porque no hay ninguno).

---

## 2. Arquitectura NestJS

```
apps/api/src/
  main.ts                     bootstrap, Swagger en /docs, prefijo /api/v1
  app.module.ts

  common/
    tenant/                   AsyncLocalStorage + middleware + decorator
    prisma/                   PrismaService + extensión de tenant-scoping
    rbac/                     @Roles(), RolesGuard, SuperAdminGuard
    geo/                      Haversine (distancia geográfica)
    decorators/               @CurrentUser()
    filters/                  Exception filter global

  auth/                       login, JwtStrategy, JwtAuthGuard
  tenants/                    alta de empresas (SUPER_ADMIN) + branding self-service
  employees/                  perfil, cargas familiares, cuentas bancarias
  payroll/                    rol de pagos (solo lectura) + sync ERP + PDF watermark
  attendance/                 marcación con validación geoespacial obligatoria
  requests/                   solicitudes + flujo de aprobación por roles
  notifications/              notificaciones segmentadas
  communication/              canales Jefe-Equipo / Jefe-Gerente
  documents/                  gestión documental con RBAC por rol/departamento
```

Cada módulo de negocio sigue el mismo patrón: `*.controller.ts` (HTTP +
guards + DTOs) → `*.service.ts` (reglas de negocio, usa
`PrismaService.client`) → Prisma. Los DTOs usan `class-validator` y se
validan globalmente con un `ValidationPipe({ whitelist: true, transform:
true })` en `main.ts`.

### 2.1 Autenticación y autorización

- **JWT** (`@nestjs/jwt` + `passport-jwt`), firmado con `sub`, `tenantId`,
  `employeeId`, `email`, `roles`.
- `JwtAuthGuard` (rutas de tenant) valida el JWT Y que
  `token.tenantId === request.tenant.id`.
- `RolesGuard` + `@Roles(...)` autorizan por rol de negocio
  (`TENANT_ADMIN`, `HR`, `MANAGER`, `APPROVER`, `EMPLOYEE`); `SUPER_ADMIN`
  siempre tiene acceso total como bypass.
- Los roles y sus permisos (`Role`, `Permission`, `RolePermission`) se
  modelan en base de datos para permitir personalización futura por
  tenant, aunque hoy la autorización de endpoints usa el enum
  `SystemRole` directamente por simplicidad y performance (evita una
  consulta de permisos por request); la tabla de permisos queda como base
  para un editor de roles granular en el panel de administración.

### 2.2 Validación georeferencial (marcación)

`attendance/attendance.service.ts`:
1. Valida que la marcación respete la secuencia esperada
   (`CHECK_IN → BREAK_START/CHECK_OUT → BREAK_END → ...`).
2. Calcula la distancia (fórmula de Haversine, `common/geo/geo.util.ts`)
   entre las coordenadas recibidas y cada `OfficeLocation` activa del
   tenant.
3. Si la sede más cercana está fuera de su `radiusMeters`, la marcación se
   **rechaza** (`403 Forbidden`, no se persiste) — la georeferenciación es
   obligatoria, no informativa.
4. Si es válida, se persiste `TimeEntry` con `officeLocationId`,
   `distanceMeters` e `isLocationValid = true`, para auditoría posterior.

### 2.3 Nómina / ERP

- **Lectura**: `PayrollController` expone `GET /payroll/me` (solo lectura,
  jamás editable desde la intranet) y `GET /payroll/me/:id/pdf`, que genera
  el PDF con marca de agua (`PdfWatermarkService`, usa `pdf-lib`) con el
  logo del tenant repetido en diagonal sobre el documento.
- **Sincronización**: `ErpSyncService` consume un conector que implementa
  `ErpPayrollClient` (interfaz; `HttpErpPayrollClient` es la implementación
  de referencia vía REST) y hace `upsert` de cada recibo por
  `(tenantId, erpReferenceId)`, garantizando idempotencia — re-ejecutar una
  sincronización nunca duplica datos. Cada corrida queda registrada en
  `PayrollSyncLog` (éxitos/fallos/errores) para trazabilidad.
- El disparo puede ser manual (`POST /payroll/sync`, rol `HR`/`TENANT_ADMIN`)
  o programado con `@nestjs/schedule` (cron) apuntando al mismo servicio.

### 2.4 Solicitudes y flujo de aprobación

`ApprovalWorkflowService` define, por `RequestType`, la cadena de roles que
deben aprobar en orden (`PERMISSION: [MANAGER]`,
`VACATION: [MANAGER, HR]`, `LOAN: [MANAGER, HR]`). Al crear una solicitud se
generan sus `ApprovalStep` (uno por rol de la cadena, en `PENDING`).
`RequestsService.decide()`:
- Solo permite actuar sobre el paso cuyo `stepOrder === request.currentStep`.
- Verifica que el usuario tenga el rol requerido por ese paso y, si el rol
  es `MANAGER`, que sea efectivamente el jefe directo del empleado
  (`Employee.managerId`).
- Un rechazo termina el flujo (`Request.status = REJECTED`); una aprobación
  avanza al siguiente paso o, si era el último, marca `APPROVED`.

### 2.5 Documentos (RBAC por cargo/departamento)

`Document`/`DocumentFolder` tienen `DocumentPermission` (rol +
opcionalmente departamento + `canRead`/`canWrite`). Un documento sin
permisos explícitos es visible para todo el tenant; si los tiene, sólo
usuarios cuyo rol (y departamento, si aplica) matchean pueden leerlo.
`TENANT_ADMIN`/`SUPER_ADMIN` siempre tienen bypass administrativo.

---

## 3. Arquitectura Astro

```
apps/web/src/
  middleware.ts              tenant + branding + sesión, en CADA request
  lib/
    tenant.ts                 resuelve slug por subdominio/host
    session.ts                cookie httpOnly con el JWT
    api.ts                    cliente HTTP hacia la API (SSR)
  layouts/
    BaseLayout.astro          inyecta CSS vars con el branding del tenant
  components/
    Sidebar.astro             menú, filtrado por rol
  pages/
    login.astro
    logout.ts
    index.astro
    attendance/index.astro    marcación (Geolocation API del navegador)
    payroll/index.astro
    requests/index.astro      crear + listar propias
    requests/pending.astro    bandeja de aprobación (roles Jefe/HR/Approver)
    documents/index.astro
    notifications/index.astro
    api/[...path].ts          proxy BFF hacia la API (ver 3.3)
```

Astro corre en modo **SSR** (`output: 'server'`, adaptador `@astrojs/node`)
porque el theming y la sesión dependen del request (no se puede
pre-renderizar un sitio estático que sirve N empresas distintas con un
solo build).

### 3.1 Resolución de tenant + theming dinámico

`middleware.ts` resuelve el slug del tenant igual que el backend
(subdominio del `Host`), pide su branding a
`GET /platform/tenants/:slug/branding` (endpoint público, sin datos
sensibles) y lo deja en `Astro.locals.branding`. `BaseLayout.astro` inyecta
esos valores como variables CSS (`define:vars`) en cada página — el MISMO
build de Astro sirve el logo/colores correctos de cada empresa sin
recompilar nada por cliente.

### 3.2 Sesión

El JWT se guarda en una cookie **httpOnly** (`session.ts`), nunca en
`localStorage` ni expuesto a JavaScript del navegador. Para uso de UI (qué
menú mostrar) se decodifica el payload del JWT sin verificar firma —la
verificación real de firma/expiración la hace siempre la API en cada
request—. `middleware.ts` protege todas las rutas salvo `/login`: sin
sesión válida, redirige con `?next=`.

### 3.3 Proxy BFF (`pages/api/[...path].ts`)

Como el JWT vive en una cookie httpOnly, el JavaScript del cliente (p. ej.
el script de marcación que usa `navigator.geolocation`) no puede adjuntarlo
como header `Authorization` directamente. Astro expone una ruta catch-all
`/api/*` que se ejecuta en el servidor de Astro, lee la cookie, y reenvía la
petición a la API de NestJS con `Authorization` y `X-Tenant-Slug`. El
cliente sólo conoce `/api/...`, nunca la URL real de la API ni el token.

### 3.4 Multiplataforma

Astro con islands architecture permite mezclar HTML server-rendered (rápido,
buen SEO/carga inicial para el portal de intranet) con componentes
interactivos puntuales (marcación, formularios de aprobación) sin cargar un
framework SPA completo. Para **app móvil nativa**, la misma capa Astro SSR
puede:
- Servirse como **PWA instalable** (agregar `manifest.json` + service
  worker; el layout ya es responsive y usa CSS variables, no requiere
  cambios de theming).
- Empaquetarse con **Capacitor** (WebView nativo) apuntando al mismo
  despliegue SSR, reutilizando el 100% del código de páginas.

---

## 4. Seguridad multi-tenant — resumen de controles

| Control | Dónde |
|---|---|
| Resolución de tenant por request | `TenantMiddleware` (API) / `middleware.ts` (Astro) |
| JWT atado a un tenant específico | `JwtAuthGuard.handleRequest` |
| Scoping automático de queries | `tenant-scoping.extension.ts` |
| RBAC por rol de negocio | `RolesGuard` + `@Roles()` |
| RBAC por rol+departamento en documentos | `DocumentsService.canRead` |
| Aislamiento de plataforma (SUPER_ADMIN) | `SuperAdminGuard`, rutas `/platform/**` |
| Georeferenciación obligatoria | `AttendanceService.clock` |
| Idempotencia de sync ERP | `@@unique([tenantId, erpReferenceId])` en `Payslip` |
