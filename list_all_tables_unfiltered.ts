import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Listing ALL tables from pg_tables...");
        const res: any[] = await prisma.$queryRaw`SELECT schemaname, tablename FROM pg_catalog.pg_tables ORDER BY schemaname, tablename`;
        res.forEach(r => {
            if (r.schemaname !== 'pg_catalog' && r.schemaname !== 'information_schema') {
                console.log(`${r.schemaname}.${r.tablename}`);
            }
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
