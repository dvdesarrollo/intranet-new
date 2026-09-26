import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Factory de PrismaClient para runtime (apps/api, workers de sync ERP).
 * Usa un connection pool propio (pg) vía driver adapter, requerido desde
 * Prisma 7 en lugar de la URL declarada en el schema.
 */
export function createPrismaClient(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está definida');
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export type AppPrismaClient = ReturnType<typeof createPrismaClient>;

export * from '@prisma/client';
