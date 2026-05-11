
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const b = await prisma.$queryRaw`SELECT * FROM "BASES" LIMIT 1`;
        console.log('BASES 1st row keys:', Object.keys(b[0]));

        const c = await prisma.$queryRaw`SELECT * FROM "COLORANTES" LIMIT 1`;
        console.log('COLORANTES 1st row keys:', Object.keys(c[0]));
    } catch (e: any) {
        console.log('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
