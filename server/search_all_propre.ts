
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const res = await prisma.$queryRaw`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name ILIKE '%pro_pre%'
  `;
    console.log('Tables matching pro_pre:', JSON.stringify(res, null, 2));
}
main();
