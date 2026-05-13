import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Intentando eliminar la restricción formulas_business_key de la tabla FORMULAS...');
        await prisma.$executeRawUnsafe(`ALTER TABLE "FORMULAS" DROP CONSTRAINT IF EXISTS formulas_business_key;`);
        console.log('Restricción eliminada exitosamente.');
    } catch (error) {
        console.error('Error al intentar eliminar la restricción:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
