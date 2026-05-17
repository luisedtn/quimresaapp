
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const res = await prisma.$queryRaw`SELECT * FROM "FORMULAS" LIMIT 1` as any[];
        if (res.length > 0) {
            console.log('FORMULAS columns:', Object.keys(res[0]));
        } else {
            console.log('No formulas found');
        }
    } finally {
        await prisma.$disconnect();
    }
}
main();
