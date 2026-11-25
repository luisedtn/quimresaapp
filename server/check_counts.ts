import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.usuario.findMany({
    select: { name: true, typeuser: true, idcliente: true, cliente: { select: { CODIGO: true, NOMBRE: true, issuper: true } } }
  });
  console.log('ALL USERS:', JSON.stringify(users, null, 2));

  for (const u of users) {
    if (u.idcliente) {
      const count = await prisma.formPersonales.count({ where: { IDCLIENTE: u.idcliente } });
      const withLote = await prisma.formPersonales.count({ where: { IDCLIENTE: u.idcliente, LOTE: { not: null, notIn: [''] } } });
      const withoutLote = await prisma.formPersonales.count({ where: { IDCLIENTE: u.idcliente, OR: [{ LOTE: null }, { LOTE: '' }] } });
      console.log(`Cliente ${u.idcliente} (${u.cliente?.NOMBRE}) [issuper=${u.cliente?.issuper}, typeuser=${u.typeuser}]: Total=${count}, Con Lote=${withLote}, Sin Lote=${withoutLote}`);
    }
  }

  // Count without IDCLIENTE or null
  const nullClient = await prisma.formPersonales.count({ where: { IDCLIENTE: null } });
  console.log('Formulas con IDCLIENTE null:', nullClient);
}

main().catch(console.error).finally(() => prisma.$disconnect());
