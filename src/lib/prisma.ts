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

export async function ensureDatabaseSchema() {
  globalForPrisma.schemaReady ??= (async () => {
    const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("RelationshipState")');
    if (!columns.some((column) => column.name === "dynamicProfile")) {
      await prisma.$executeRawUnsafe('ALTER TABLE "RelationshipState" ADD COLUMN "dynamicProfile" JSONB');
    }
  })();

  return globalForPrisma.schemaReady;
}
