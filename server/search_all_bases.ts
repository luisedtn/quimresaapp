
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const res = await prisma.$queryRaw`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name ILIKE '%BASES%'
  `;
    console.log('Tables matching BASES:', JSON.stringify(res, null, 2));
}
main();
