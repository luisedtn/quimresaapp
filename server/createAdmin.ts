import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const adminEmail = 'admin@quimresa.com';
    const adminPassword = 'admin'; // Contraseña inicial

    // Asegurar que existe un cliente (empresa) primero
    let cliente = await prisma.cliente.findFirst();
    if (!cliente) {
        cliente = await prisma.cliente.create({
            data: {
                NOMBRE: 'Quimresa Matriz',
                autorizado: true,
            }
        });
        console.log('Cliente creado:', cliente.NOMBRE);
    }

    // Encriptar la contraseña
    const hashedPass = await bcrypt.hash(adminPassword, 10);

    // Crear o actualizar el administrador
    const adminDoc = await prisma.usuario.findFirst({ where: { name: adminEmail } });

    if (adminDoc) {
        await prisma.usuario.update({
            where: { id: adminDoc.id },
            data: {
                pass: hashedPass,
                autorizado: true,
                idcliente: cliente.CODIGO
            }
        });
        console.log('Usuario administrador actualizado exitosamente.');
    } else {
        await prisma.usuario.create({
            data: {
                name: adminEmail,
                pass: hashedPass,
                autorizado: true,
                typeuser: 1,
                permisos: 99,
                idcliente: cliente.CODIGO
            }
        });
        console.log('Usuario administrador creado exitosamente.');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
