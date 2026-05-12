
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const invalidFormulas = await prisma.$queryRawUnsafe(`
      SELECT "id", "NOMBRE", "IDCARTA" 
      FROM "FORMULAS" 
      WHERE "IDCARTA" NOT IN (SELECT "ID" FROM "CARTAS")
      AND "IDCARTA" IS NOT NULL
    `);

        console.log('--- FÓRMULAS CON IDCARTA HUÉRFANO ---');
        console.log(`Cantidad encontrada: ${(invalidFormulas as any[]).length}`);
        console.log(JSON.stringify(invalidFormulas, null, 2));

        // Opcional: Mostramos qué ID de cartas están faltando exactamente
        const missingCartasIds = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT "IDCARTA" 
      FROM "FORMULAS" 
      WHERE "IDCARTA" NOT IN (SELECT "ID" FROM "CARTAS")
      AND "IDCARTA" IS NOT NULL
    `);
        console.log('\n--- ID DE CARTAS QUE FALTAN EN LA TABLA "CARTAS" ---');
        console.log(JSON.stringify(missingCartasIds, null, 2));

    } catch (err: any) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
