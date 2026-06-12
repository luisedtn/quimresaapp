import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    console.log("Checking if formpersonales has records with IDFORMULA...");
    const lotes = await prisma.$queryRawUnsafe(
      `SELECT * FROM "formpersonales" WHERE "IDFORMULA" IS NOT NULL LIMIT 5`
    );
    console.log("Sample rows with IDFORMULA:", lotes);
    
    const count = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::text FROM "formpersonales" WHERE "IDFORMULA" = $1`,
      '1621'
    );
    console.log("Count of batches for formula ID '1621' (as string):", count);

    const countInt = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::text FROM "formpersonales" WHERE "IDFORMULA" = $1`,
      1621
    );
    console.log("Count of batches for formula ID 1621 (as number):", countInt);

  } catch (error: any) {
    console.error("Error executing query on formpersonales:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
