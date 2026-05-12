import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Searching for tables containing 'COLOR' or 'BASE'...");
        const tables: any[] = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%color%' OR table_name ILIKE '%base%'`;
        console.log("Matching tables:", tables);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
