const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function list() {
    const res = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('TABLES:', res);
    prisma.$disconnect();
}
list();
