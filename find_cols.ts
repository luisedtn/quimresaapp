import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Checking for columns in any table named 'COLORANTES'...");
        const cols: any[] = await prisma.$queryRaw`SELECT table_schema, table_name, column_name FROM information_schema.columns WHERE table_name ILIKE 'colorantes'`;
        console.table(cols);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
