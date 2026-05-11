
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const res = await prisma.$queryRaw`SELECT * FROM "PRODUCTOS" LIMIT 3`;
    console.log('PRODUCTOS rows:', JSON.stringify(res, null, 2));
}
main();
