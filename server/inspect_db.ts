
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Inspecting PRODUCTOS data...");
        const products = await prisma.$queryRaw`SELECT "ID", "PRODUCTO", "MARCA" FROM "PRODUCTOS" LIMIT 5`;
        console.log("Sample products:", JSON.stringify(products, null, 2));

        console.log("Inspecting FORMULAS data...");
        const formulas = await prisma.$queryRaw`SELECT "id", "NOMBRE", "IDMARCA" FROM "FORMULAS" LIMIT 5`;
        console.log("Sample formulas:", JSON.stringify(formulas, null, 2));

    } catch (err: any) {
        console.error("Database inspection error:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
