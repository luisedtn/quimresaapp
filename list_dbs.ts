import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Checking all databases on the server...");
        const dbs: any[] = await prisma.$queryRaw`SELECT datname FROM pg_database WHERE datallowconn = true`;
        console.log("Available databases:", dbs.map(d => d.datname));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
