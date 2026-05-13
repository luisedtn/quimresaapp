import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const totalStandard = await prisma.formula.count();
        const standardWithLAB = await prisma.formula.count({
            where: { L: { not: null }, A: { not: null }, B: { not: null } }
        });

        const totalPersonal = await prisma.formPersonales.count();
        const personalWithLAB = await prisma.formPersonales.count({
            where: { L: { not: null }, A: { not: null }, B: { not: null } }
        });

        console.log(`Standard: total=${totalStandard}, withLAB=${standardWithLAB}`);
        console.log(`Personal: total=${totalPersonal}, withLAB=${personalWithLAB}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
