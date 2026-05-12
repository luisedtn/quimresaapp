import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Dumping all tables from all schemas...");
        const res: any[] = await prisma.$queryRaw`SELECT schemaname, tablename FROM pg_catalog.pg_tables`;
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
