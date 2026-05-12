
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const tables = ['BASES', 'COLORANTES'];
    for (const table of tables) {
        const columns = await prisma.$queryRawUnsafe(`
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns
            WHERE table_name = '${table}'
            AND table_schema = 'public'
            ORDER BY ordinal_position
        `);
        console.log(`Table ${table} structure:`, JSON.stringify(columns, null, 2));
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
