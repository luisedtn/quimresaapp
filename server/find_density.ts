
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const schemas: any[] = await prisma.$queryRaw`SELECT table_name FROM information_schema.columns WHERE column_name = 'DENSIDAD'`;
        console.log('Tables with DENSIDAD column:', JSON.stringify(schemas, null, 2));

        for (const s of schemas) {
            const table = s.table_name;
            const sample = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}" LIMIT 1`);
            console.log(`Sample from ${table}:`, JSON.stringify(sample, null, 2));
        }
    } catch (e: any) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
