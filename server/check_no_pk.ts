
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const res = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name NOT IN (
      SELECT table_name 
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'PRIMARY KEY'
    )
  `;
    console.log('Tables without PK:', JSON.stringify(res, null, 2));
}
main();
