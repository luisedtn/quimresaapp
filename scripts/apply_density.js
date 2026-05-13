import fs from 'fs';
let content = fs.readFileSync('c:/quimresaapp/src/pages/ColorMatch.tsx', 'utf8');

// 1. Component Color interface
content = content.replace(
    /quantity\?: number; \/\/ Cantidad en la fórmula/,
    "quantity?: number; // Cantidad en la fórmula\n    ml?: number;\n    rho?: number;"
);

// 2. Fetch densities
const replaceSrc = `                let colorantsSum = 0;

                // First pass to parse data and calculate colorants sum`;

const replacement = `                // FETCH DENSIDADES
                const resDens = await fetch(\`\${API_BASE_URL}/api/componentes/densidades\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${token}\`,
                    },
                    body: JSON.stringify({ codigos: codes }),
                });
                let densityMap: Record<string, number> = {};
                if (resDens.ok) {
                    const dataDens = await resDens.json();
                    dataDens.forEach((item: any) => {
                        densityMap[item.CODIGO] = item.DENSIDAD || 1.0;
                    });
                }

                let colorantsSum = 0;

                // First pass to parse data and calculate colorants sum`;

content = content.replace(replaceSrc, replacement);

// 3. Calculation logic
const replaceSrcFullRegex = /\/\/ First pass to parse data and calculate colorants sum[\s\S]*?console\.log\('Colores de componentes procesados:', enrichedData\);/s;

const newProcessing = `// First pass to parse data and calculate colorants sum
                const parsedData = data.map(cc => {
                    const code = cc.code;
                    let quantity = 0;
                    let isBaseComponent = (code === baseCode);

                    if (!isBaseComponent) {
                        for (let i = 1; i <= 13; i++) {
                            if (f[\`C\${i}\`] === code) { quantity = normalizeDecimal(f[\`Q\${i}\`] || '0'); break; }
                        }
                        if (quantity === 0) {
                            for (let i = 1; i <= 6; i++) {
                                if (f[\`A\${i}\`] === code) { quantity = normalizeDecimal(f[\`AQ\${i}\`] || '0'); break; }
                            }
                        }
                        if (quantity === 0) {
                            for (let i = 1; i <= 5; i++) {
                                if (f[\`B\${i}\`] === code) { quantity = normalizeDecimal(f[\`BQ\${i}\`] || '0'); break; }
                            }
                        }
                        colorantsSum += quantity;
                    }

                    return { ...cc, preQuantity: quantity, isBaseComponent };
                });

                let totalRawMass = 0;
                let totalRawVolume = 0;

                // Assign base mass and calculate mixture density parts
                const componentsWithPhysics = parsedData.map(cc => {
                    let quantity = cc.preQuantity;
                    if (cc.isBaseComponent) {
                        quantity = 1000 - colorantsSum;
                    }
                    const rho = densityMap[cc.code] || 1.0;
                    const vol = quantity / rho;
                    
                    totalRawMass += quantity;
                    totalRawVolume += vol;

                    return { ...cc, quantity, rho };
                });

                const calculatedMixtureDensity = totalRawVolume > 0 ? (totalRawMass / totalRawVolume) : 1.0;

                // Second pass to compute final quantities (ml) and sort
                const enrichedData = componentsWithPhysics.map(cc => {
                    const normalizedQty = Math.round(normalizeDecimal(cc.quantity) * 100) / 100;
                    const finalVol = cc.quantity * calculatedMixtureDensity;
                    
                    return { ...cc, quantity: normalizedQty, ml: finalVol, isBaseComponent: cc.isBaseComponent };
                }).sort((a, b) => {
                    if (a.isBaseComponent && !b.isBaseComponent) return -1;
                    if (!a.isBaseComponent && b.isBaseComponent) return 1;
                    return (a.quantity || 0) - (b.quantity || 0);
                });

                console.log('Colores de componentes procesados (con densidades):', enrichedData);`;

content = content.replace(replaceSrcFullRegex, newProcessing);

// 4. UI changes
const uiReplaceRegex = /<div className="text-\[9px\] font-bold text-slate-300 text-right">\s*\{.*?\)\.toFixed\(2\)\}g\s*<\/div>/s;

const uiNew = `<div className="text-right flex items-center justify-end gap-3">
                                                    <div>
                                                        <p className="text-[11px] font-mono font-bold text-white">
                                                            {((cc.ml || 0) as number).toFixed(2)} <span className="text-[8px] text-slate-500 uppercase">ml</span>
                                                        </p>
                                                    </div>
                                                    <div className="w-12">
                                                        <p className="text-[9px] font-mono font-bold text-slate-400">
                                                            {((cc.quantity || 0) as number).toFixed(2)}g
                                                        </p>
                                                    </div>
                                                </div>`;

content = content.replace(uiReplaceRegex, uiNew);

fs.writeFileSync('c:/quimresaapp/src/pages/ColorMatch.tsx', content);

console.log('Done script.');
