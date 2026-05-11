
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const f = await prisma.formula.findFirst();
    console.log('Standard Formula Sample:', JSON.stringify(f, null, 2));
}
main();
