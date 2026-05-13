import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const totalFormulas = await prisma.formula.count();
        const formulasWithLAB = await prisma.formula.count({
            where: {
                L: { not: null },
                A: { not: null },
                B: { not: null },
            }
        });
        console.log(`Total formulas: ${totalFormulas}`);
        console.log(`Formulas with LAB: ${formulasWithLAB}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
