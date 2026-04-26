import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Intentando conectar a la base de datos PostgreSQL...");
        await prisma.$connect();
        console.log("✅ ¡Conexión exitosa a PostgreSQL!");

        // Intenta hacer una consulta simple
        const userCount = await prisma.usuario.count();
        console.log(`👥 Número de usuarios detectados en la tabla 'usuarios': ${userCount}`);

        const clientCount = await prisma.cliente.count();
        console.log(`🏢 Número de clientes detectados en la tabla 'clientes': ${clientCount}`);

    } catch (error) {
        console.error("❌ Error al conectar a la base de datos:");
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
