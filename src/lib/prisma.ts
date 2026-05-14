import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  schemaReady?: Promise<void>;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

async function ensureColumn(table: string, column: string, sqlType: string) {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${table}")`);
  if (!columns.some((item) => item.name === column)) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${sqlType}`);
  }
}

export async function ensureDatabaseSchema() {
  globalForPrisma.schemaReady ??= (async () => {
    await ensureColumn("RelationshipState", "dynamicProfile", "JSONB");
    await ensureColumn("World", "directorConfig", "JSONB");
    await ensureColumn("Session", "playerProfile", "JSONB");
  })();

  return globalForPrisma.schemaReady;
}
