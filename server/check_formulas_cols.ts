
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const res = await prisma.$queryRaw`SELECT * FROM "FORMULAS" LIMIT 1`;
        console.log('FORMULAS columns:', Object.keys(res[0]));
    } finally {
        await prisma.$disconnect();
    }
}
main();
