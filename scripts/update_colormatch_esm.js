import fs from 'fs';
let content = fs.readFileSync('c:/quimresaapp/src/pages/ColorMatch.tsx', 'utf8');

// 1. Reemplazar baseCode calculation
content = content.replace(
    'const baseCode = f.BASE || f.RESERVA || f.CBASE;',
    "const baseCode = match.source === 'standard' ? f.RESERVA : f.CBASE;"
);

// 2. Modificar el mapeo de `enrichedData` para calcular `quantity = 1000 - colorantsSum` para la base (líneas 194-233)
const newBlock = `
                  let colorantsSum = 0;

                  // First pass to parse data and calculate colorants sum
                  const parsedData = data.map(cc => {
                      const code = cc.code;
                      let quantity = 0;
                      let isBaseComponent = (code === baseCode);

                      if (!isBaseComponent) {
                          // Buscar en C(1-13)
                          for (let i = 1; i <= 13; i++) {
                              if (f[\`C\${i}\`] === code) {
                                  quantity = normalizeDecimal(f[\`Q\${i}\`] || '0');
                                  break;
                              }
                          }
                          // Si no se encontro, buscar en A(1-6)
                          if (quantity === 0) {
                              for (let i = 1; i <= 6; i++) {
                                  if (f[\`A\${i}\`] === code) {
                                      quantity = normalizeDecimal(f[\`AQ\${i}\`] || '0');
                                      break;
                                  }
                              }
                          }
                          // Si no se encontro, buscar en B(1-5)
                          if (quantity === 0) {
                              for (let i = 1; i <= 5; i++) {
                                  if (f[\`B\${i}\`] === code) {
                                      quantity = normalizeDecimal(f[\`BQ\${i}\`] || '0');
                                      break;
                                  }
                              }
                          }
                          colorantsSum += quantity;
                      }

                      return { ...cc, preQuantity: quantity, isBaseComponent };
                  });

                  // Second pass to compute base quantity and prepare sorting
                  const enrichedData = parsedData.map(cc => {
                      let quantity = cc.preQuantity;
                      if (cc.isBaseComponent) {
                          quantity = 1000 - colorantsSum;
                      }

                      // Store quantity as number with exactly 2 decimal places
                      const normalizedQty = Math.round(normalizeDecimal(quantity) * 100) / 100;
                      return { ...cc, quantity: normalizedQty, isBaseComponent: cc.isBaseComponent };
                  }).sort((a, b) => {
                      if (a.isBaseComponent && !b.isBaseComponent) return -1;
                      if (!a.isBaseComponent && b.isBaseComponent) return 1;
                      return 0;
                  });

                  console.log('Colores de componentes procesados:', enrichedData);
`;

const replaceRegex = /\/\/ Mapear cantidades desde la f[\s\S]*?console.log\('Colores de componentes procesados:', enrichedData\);/m;
content = content.replace(replaceRegex, newBlock);

fs.writeFileSync('c:/quimresaapp/src/pages/ColorMatch.tsx', content);

console.log('Done replacement.');
