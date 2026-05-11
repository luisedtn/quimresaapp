
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const tables = ['BASES', 'COLORANTES', 'pro_pre', 'PRODUCTOS'];
        for (const table of tables) {
            try {
                const res = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}" LIMIT 3`);
                console.log(`Table ${table}:`, JSON.stringify(res, null, 2));
            } catch (e: any) {
                console.log(`Table ${table} error:`, e.message);
            }
        }
    } finally {
        await prisma.$disconnect();
    }
}
main();
