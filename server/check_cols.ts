
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const b = await prisma.$queryRaw`SELECT * FROM "BASES" LIMIT 1` as any[];
        console.log('BASES 1st row keys:', b.length > 0 ? Object.keys(b[0]) : 'no records');

        const c = await prisma.$queryRaw`SELECT * FROM "COLORANTES" LIMIT 1` as any[];
        console.log('COLORANTES 1st row keys:', c.length > 0 ? Object.keys(c[0]) : 'no records');
    } catch (e: any) {
        console.log('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
