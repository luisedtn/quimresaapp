
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const result = await prisma.$executeRawUnsafe(`
      UPDATE "FORMULAS" 
      SET "IDCARTA" = 1 
      WHERE "IDCARTA" NOT IN (SELECT "ID" FROM "CARTAS")
      AND "IDCARTA" IS NOT NULL
    `);

        console.log(`¡Éxito! Se actualizaron ${result} fórmulas huérfanas a IDCARTA = 1.`);

    } catch (err: any) {
        console.error('Error al actualizar:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
