import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

// Helper: analyze BGR color luminance to auto-determine text color
function autoTextColor(bgrColor: number): number {
  const r = bgrColor & 0xFF;
  const g = (bgrColor >> 8) & 0xFF;
  const b = (bgrColor >> 16) & 0xFF;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  // If background is bright → dark text (black=0), if dark → light text (white=16777215)
  return luminance > 128 ? 0 : 16777215;
}

const defaultRangos = [
  { VALOR: 0.3,         NOMBRE: 'EXCELENTE',  COLOR: 8454016 },
  { VALOR: 0.6,         NOMBRE: 'APROBADO',   COLOR: 65535 },
  { VALOR: 0.9,         NOMBRE: 'ACEPTABLE',  COLOR: 33023 },
  { VALOR: 1.2,         NOMBRE: 'REGULAR',    COLOR: 8388736 },
  { VALOR: 999999999.0, NOMBRE: 'NO PASA',    COLOR: 255 },
];

async function main() {
  console.log('Seeding deltarango table...');

  // Clear existing data
  await prisma.$queryRawUnsafe(`DELETE FROM "deltarango"`);

  // Insert defaults with auto-computed COLORTEXTO
  for (const rango of defaultRangos) {
    const colortexto = autoTextColor(rango.COLOR);
    await prisma.$queryRawUnsafe(
      `INSERT INTO "deltarango" ("VALOR", "NOMBRE", "COLOR", "COLORTEXTO") VALUES ($1, $2, $3, $4)`,
      rango.VALOR,
      rango.NOMBRE,
      rango.COLOR,
      colortexto
    );
    console.log(`  ✓ ${rango.NOMBRE} (VALOR=${rango.VALOR}, COLOR=${rango.COLOR}, COLORTEXTO=${colortexto})`);
  }

  console.log('Done! 5 rows inserted.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
