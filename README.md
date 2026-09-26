# Intranet Multiempresa (Multi-tenant)

Intranet corporativa multi-empresa: cada empresa (tenant) tiene su propio
branding, empleados, nómina, marcación, solicitudes, comunicación interna y
documentos, sobre una sola infraestructura compartida.

**Stack**: NestJS 12 · Astro 7 (SSR) · PostgreSQL · Prisma 7.

Ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) para el diseño completo
(estrategia multi-tenant, módulos de NestJS, arquitectura de Astro) y
[`docs/ENDPOINTS.md`](docs/ENDPOINTS.md) para la lista de endpoints REST.

## Estructura del monorepo

```
apps/
  api/          NestJS — API REST
  web/          Astro — frontend SSR multi-tenant
packages/
  database/     schema.prisma, cliente Prisma, seed
docs/           Documentación de arquitectura y endpoints
```

## Requisitos

- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL ≥ 15

## Puesta en marcha

```bash
pnpm install

# Base de datos
cp packages/database/.env.example packages/database/.env
# editar DATABASE_URL en packages/database/.env
pnpm db:generate
pnpm db:migrate      # crea las tablas
pnpm db:seed         # catálogo de bancos, roles y permisos base

# API
cp apps/api/.env.example apps/api/.env
pnpm dev:api         # http://localhost:3000/api/v1  (Swagger en /docs)

# Frontend
cp apps/web/.env.example apps/web/.env
pnpm dev:web         # http://localhost:4321
```

### Crear la primera empresa (tenant)

Las empresas se dan de alta desde el panel de plataforma
(`POST /api/v1/platform/tenants`, rol `SUPER_ADMIN`). El primer
`SUPER_ADMIN` se crea manualmente (ver `packages/database/prisma/seed.ts`
como punto de partida) ya que, por diseño, ningún usuario de plataforma
pertenece a una empresa.

## Scripts útiles

| Comando | Descripción |
|---|---|
| `pnpm dev:api` | API en modo watch |
| `pnpm dev:web` | Frontend Astro en modo dev |
| `pnpm build` | Build de todos los paquetes/apps |
| `pnpm db:migrate` | Aplica migraciones de Prisma |
| `pnpm db:seed` | Carga catálogos base (bancos, roles, permisos) |
