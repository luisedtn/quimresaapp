
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const res = await prisma.$queryRaw`SELECT table_name, column_name FROM information_schema.columns WHERE column_name ILIKE '%DENSIDAD%'`;
        console.log(JSON.stringify(res, null, 2));
    } finally {
        await prisma.$disconnect();
    }
}
main();
