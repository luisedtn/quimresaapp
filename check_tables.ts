import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Checking tables...");
        const tables: any[] = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
        console.log("Tables in 'public' schema:", tables.map(t => t.table_name));

        // Try case-insensitive check
        const colorantesTable = tables.find(t => t.table_name.toLowerCase() === 'colorantes');
        if (colorantesTable) {
            console.log(`Found colorantes table: ${colorantesTable.table_name}`);
            const sample = await prisma.$queryRawUnsafe(`SELECT * FROM "${colorantesTable.table_name}" LIMIT 5`);
            console.log(`Sample from ${colorantesTable.table_name}:`, JSON.stringify(sample, null, 2));
        }

        const basesTable = tables.find(t => t.table_name.toLowerCase() === 'bases');
        if (basesTable) {
            console.log(`Found bases table: ${basesTable.table_name}`);
            const sample = await prisma.$queryRawUnsafe(`SELECT * FROM "${basesTable.table_name}" LIMIT 5`);
            console.log(`Sample from ${basesTable.table_name}:`, JSON.stringify(sample, null, 2));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
