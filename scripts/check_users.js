
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:9db5e5a64387efaa96264ebd79551fd9@178.238.237.30:5432/quimresa?schema=public"
        }
    }
});

async function main() {
    const users = await prisma.usuario.findMany({ take: 5 });
    console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
