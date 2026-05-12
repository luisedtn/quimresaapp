import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Checking all views...");
        const views: any[] = await prisma.$queryRaw`SELECT table_schema, table_name FROM information_schema.views WHERE table_schema NOT IN ('information_schema', 'pg_catalog')`;
        console.table(views);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
