
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Inspecting formpersonales data...");
        const fps = await prisma.$queryRaw`SELECT "ID", "PRODUCTO", "CARTA", "MARCA" FROM "formpersonales" LIMIT 5`;
        console.log("Sample formpersonales:", JSON.stringify(fps, null, 2));

    } catch (err: any) {
        console.error("Database inspection error:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
