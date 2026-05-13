import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        // Intentar buscar por CODIGO ya que el usuario dice que está ahí
        const results = await prisma.$queryRawUnsafe(
            `SELECT * FROM "formpersonales" WHERE "CODIGO" = 'PU002372' LIMIT 1`
        );
        console.log('Resultados de búsqueda directa por CODIGO:');
        console.log(JSON.stringify(results, null, 2));

        // Intentar buscar algun registro donde IDFORMULA no sea un numero (en SQL crudo)
        const weirdIdFormula = await prisma.$queryRawUnsafe(
            `SELECT "ID", "CODIGO", "IDFORMULA" FROM "formpersonales" WHERE "IDFORMULA" !~ '^[0-9]+$' AND "IDFORMULA" IS NOT NULL LIMIT 5`
        );
        console.log('Registros con IDFORMULA no numérico:');
        console.log(JSON.stringify(weirdIdFormula, null, 2));

    } catch (e) {
        console.error('Error durante la inspección:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
