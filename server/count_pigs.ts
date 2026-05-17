import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const bases = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM "BASES"');
        const colorantes = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM "COLORANTES"');
        console.log('BASES:', bases);
        console.log('COLORANTES:', colorantes);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
