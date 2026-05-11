
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const counts = await prisma.$queryRaw`SELECT "COLORANTE", count(*) FROM "COLORANTES" GROUP BY "COLORANTE"`;
        console.log('Counts in COLORANTES:', counts);
    } finally {
        await prisma.$disconnect();
    }
}
main();
