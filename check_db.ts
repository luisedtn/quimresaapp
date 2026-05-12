import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Checking COLORANTES table...");
        const colorantes: any[] = await prisma.$queryRaw`SELECT "PRODUCTO", "COLOR" FROM "COLORANTES" LIMIT 10`;
        console.log("COLORANTES:", JSON.stringify(colorantes, null, 2));

        console.log("\nChecking BASES table...");
        const bases: any[] = await prisma.$queryRaw`SELECT "CODIGO", "COLOR" FROM "BASES" LIMIT 10`;
        console.log("BASES:", JSON.stringify(bases, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
