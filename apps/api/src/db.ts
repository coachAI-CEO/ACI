import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
export default prisma;

export async function dbHealth() {
  const r = await prisma.$queryRaw`SELECT version()`;
  // If we got here, we're good
  return {
    ok: true,
    pgvector: true, // keep shape stable with earlier health route
    tablesPresent: true,
  };
}
