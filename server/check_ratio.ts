
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const f = await prisma.formula.findFirst({
        where: { Q1: { gt: 0 }, QV1: { gt: 0 } }
    });
    if (f) {
        console.log('Formula sample:', {
            Q1: f.Q1,
            QV1: f.QV1,
            ratio: Number(f.Q1) / Number(f.QV1)
        });
    } else {
        console.log('No formula found with Q1 and QV1 > 0');
    }
}
main();
