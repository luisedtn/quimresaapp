import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Search, Scan, Keyboard, Layers, ChevronRight, Target, Sliders, Beaker, Check, Sparkles } from 'lucide-react';
import { useNixDevice } from '../hooks/useNixDevice';
import { deltaE2000 } from '../services/NixBluetoothService';
import { API_BASE_URL } from '../config';

// ----------------------------------------------------------------
// L*a*b* → sRGB hex helper (identical to QualityControl)
// ----------------------------------------------------------------
function labToHex(l: number, a: number, b: number): string {
    const y = (l + 16) / 116;
    const x = a / 500 + y;
    const z = y - b / 200;
    const x3 = x * x * x, y3 = y * y * y, z3 = z * z * z;
    const xr = x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787;
    const yr = y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787;
    const zr = z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787;
    const rl = xr * 3.2406 + yr * -1.5372 + zr * -0.4986;
    const gl = xr * -0.9689 + yr * 1.8758 + zr * 0.0415;
    const bl = xr * 0.0557 + yr * -0.2040 + zr * 1.0570;
    const gamma = (c: number) =>
        Math.round(Math.max(0, Math.min(255, (c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c) * 255)));
    return `#${gamma(rl).toString(16).padStart(2, '0')}${gamma(gl).toString(16).padStart(2, '0')}${gamma(bl).toString(16).padStart(2, '0')}`;
}

// ----------------------------------------------------------------
// Interfaces
// ----------------------------------------------------------------
interface MatchResult {
    formula: any;
    deltaE: number;
    source: 'standard' | 'personal';
    hex: string;
}

interface ComponentColor {
    code: string;
    rgb: string;       // hex color
    isBase: boolean;
    baseType?: 'white' | 'transparent' | 'colored' | 'colorant';
    quantity?: number; // Cantidad en la fórmula
    calculatedQuantity?: number; // Cantidad calculada para el volumen actual
    ml?: number;
    rho?: number;
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export default function ColorMatch() {
    const navigate = useNavigate();
    const { isConnected, measure, isMeasuring } = useNixDevice();

    // Helper function to normalize decimal separator (comma to dot)
    const normalizeDecimal = (value: string | number | undefined): number => {
        if (typeof value === 'number') return value;
        if (value === undefined || value === null) return 0;
        return parseFloat(value.toString().replace(',', '.')) || 0;
    };

    // Patron (target) color
    const [patronL, setPatronL] = useState('');
    const [patronA, setPatronA] = useState('');
    const [patronB, setPatronB] = useState('');
    const [patronHex, setPatronHex] = useState<string | null>(null);

    // Toggle manual input
    const [inputMode, setInputMode] = useState<'device' | 'manual'>('manual');

    // Search & results
    const [searchResults, setSearchResults] = useState<MatchResult[]>([]);
    const [maxResults, setMaxResults] = useState(5);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Selected formula details
    const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
    const [componentColors, setComponentColors] = useState<ComponentColor[]>([]);
    const [loadingComponents, setLoadingComponents] = useState(false);
    const [prepareAmount, setPrepareAmount] = useState<string | number>(1.0);
    const [showReadingModal, setShowReadingModal] = useState(false);
    const [sampleL, setSampleL] = useState<string | null>(null);
    const [sampleA, setSampleA] = useState<string | null>(null);
    const [sampleB, setSampleB] = useState<string | null>(null);
    const [sampleDe, setSampleDe] = useState<number | null>(null);

    const [currentLote, setCurrentLote] = useState<string>('');
    const [technicalLog, setTechnicalLog] = useState<{
        timestamp: string;
        type: 'INICIO' | 'ADICION' | 'MEDICION';
        description: string;
        data?: any;
    }[]>([]);

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyItems, setHistoryItems] = useState<any[]>([]);

    const logTechnicalStep = async (tipoPaso: string, datos: any, description?: string, explicitLote?: string) => {
        const loteToUse = explicitLote || currentLote;
        if (!selectedMatch || !loteToUse) return;
        const f = selectedMatch.formula;
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE_URL}/api/ajustes/registrar-paso`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    formulaCode: f.CODIGO || '',
                    formulaName: f.NOMBREFORMULA || f.NOMBRE || 'Sin nombre',
                    lote: loteToUse,
                    tipoPaso,
                    datos
                })
            });

            // Update local state
            setTechnicalLog(prev => [...prev, {
                timestamp: new Date().toISOString(),
                type: tipoPaso as any,
                description: description || (tipoPaso === 'ADICION' ? 'Adición aplicada' : 'Medición realizada'),
                data: datos
            }]);
        } catch (e) {
            console.error("Error logging technical step", e);
        }
    };

    const generateLote = () => {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.floor(1000 + Math.random() * 9000);
        return `BATCH-${dateStr}-${random}`;
    };

    // Escuchar sugerencias de la IA
    useEffect(() => {
        const handleSuggestions = (e: any) => {
            const { suggestions } = e.detail;
            if (!suggestions || suggestions.length === 0) return;

            setComponentColors(prev => {
                const updated = [...prev].map(c => ({ ...c })); // deep copy
                suggestions.forEach((s: any) => {
                    const existing = updated.find(c => c.code === s.code);
                    if (existing) {
                        existing.calculatedQuantity = (existing.calculatedQuantity || 0) + s.quantity;
                    } else {
                        updated.push({
                            code: s.code,
                            rgb: s.color,
                            isBase: false,
                            baseType: 'colorant',
                            quantity: 0,
                            calculatedQuantity: s.quantity
                        });
                    }
                });
                return updated;
            });

            // Registrar adición en el historial
            logTechnicalStep('ADICION',
                { suggestions },
                `Sugerencia IA aplicada: ${suggestions.map((s: any) => `${s.code}(${s.quantity}g)`).join(', ')}`
            );

            // Abrir modal de nueva lectura
            setShowReadingModal(true);
        };

        window.addEventListener('apply-ai-suggestions', handleSuggestions);
        return () => window.removeEventListener('apply-ai-suggestions', handleSuggestions);
    }, []);

    // Recompute hex preview when input changes
    useEffect(() => {
        const l = parseFloat(patronL);
        const a = parseFloat(patronA);
        const b = parseFloat(patronB);
        if (!isNaN(l) && !isNaN(a) && !isNaN(b)) {
            setPatronHex(labToHex(l, a, b));
        } else {
            setPatronHex(null);
        }
    }, [patronL, patronA, patronB]);

    // ----------------------------------------------------------------
    // Capture from device
    // ----------------------------------------------------------------
    const handleDeviceCapture = async () => {
        if (!isConnected) {
            navigate('/colorimetro', { state: { returnTo: '/color-match' } });
            return;
        }
        const result = await measure();
        if (result) {
            const rl = result.color.L;
            const ra = result.color.a;
            const rb = result.color.b;
            setPatronL(rl.toString());
            setPatronA(ra.toString());
            setPatronB(rb.toString());

            // Registrar lectura de patrón si hay un lote activo
            if (currentLote && selectedMatch) {
                logTechnicalStep('LECTURA_PATRON', { l: rl, a: ra, b: rb }, 'Lectura de patrón con dispositivo');
            }
        }
    };

    const handlePerformNewReading = async () => {
        const result = await measure();
        if (result) {
            const sl = result.color.L;
            const sa = result.color.a;
            const sb = result.color.b;

            setSampleL(sl.toString());
            setSampleA(sa.toString());
            setSampleB(sb.toString());

            // Recalcular Delta E
            const l_target = parseFloat(patronL);
            const a_target = parseFloat(patronA);
            const b_target = parseFloat(patronB);

            if (!isNaN(l_target)) {
                const de = deltaE2000(l_target, a_target, b_target, sl, sa, sb);
                setSampleDe(de);

                // Registrar medición en el historial
                logTechnicalStep('MEDICION',
                    { l: sl, a: sa, b: sb, de: de },
                    `Nueva lectura realizada. Delta E: ${de.toFixed(2)}`
                );
            }

            setShowReadingModal(false);
        }
    };

    // ----------------------------------------------------------------
    // Search formulas
    // ----------------------------------------------------------------
    const handleSearch = async () => {
        const l = parseFloat(patronL);
        const a = parseFloat(patronA);
        const b = parseFloat(patronB);
        if (isNaN(l) || isNaN(a) || isNaN(b)) return;

        console.log(`Iniciando búsqueda de color - L:${l}, A:${a}, B:${b}, límite:${maxResults}`);
        setIsSearching(true);
        setHasSearched(true);
        setSelectedMatch(null);
        setComponentColors([]);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/color-match`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ l, a, b, limit: maxResults }),
            });

            if (res.ok) {
                const data: MatchResult[] = await res.json();
                console.log(`Resultados de búsqueda recibidos: ${data.length} fórmulas encontradas`);
                // data already sorted by deltaE from backend
                const processedResults = data.map(d => ({
                    ...d,
                    hex: labToHex(
                        parseFloat(d.formula.L || '0'),
                        parseFloat(d.formula.A || '0'),
                        parseFloat(d.formula.B || '0'),
                    ),
                }));
                console.log('Resultados procesados y listos para mostrar');
                setSearchResults(processedResults);
            }
        } catch (err) {
            console.error('Error searching colors:', err);
        } finally {
            setIsSearching(false);
        }
    };

    // ----------------------------------------------------------------
    // Select a match → fetch component colors
    // ----------------------------------------------------------------
    const handleSelectMatch = async (match: MatchResult) => {
        console.log(`Seleccionando fórmula: ${match.formula.NOMBREFORMULA || match.formula.NOMBRE || 'Sin nombre'} (ΔE: ${match.deltaE.toFixed(2)})`);
        setSelectedMatch(match);
        setLoadingComponents(true);
        window.dispatchEvent(new CustomEvent('clear-chat'));

        const f = match.formula;

        // Inicializar historial técnico y Lote
        const loteExistente = f.LOTE;
        const loteParaUsar = loteExistente || generateLote();
        setCurrentLote(loteParaUsar);

        logTechnicalStep('INICIO', {
            initialDeltaE: match.deltaE,
            lote: loteParaUsar,
            source: match.source
        }, `Inicio de ciclo técnico para formula ${f.NOMBREFORMULA || f.NOMBRE}`, loteParaUsar);
        // Collect component codes
        const codes: string[] = [];
        const baseCode = match.source === 'standard' ? f.RESERVA : f.CBASE;
        if (baseCode) codes.push(baseCode);
        for (let i = 1; i <= 13; i++) {
            if (f[`C${i}`]) codes.push(f[`C${i}`]);
        }
        for (let i = 1; i <= 6; i++) {
            if (f[`A${i}`]) codes.push(f[`A${i}`]);
        }
        for (let i = 1; i <= 5; i++) {
            if (f[`B${i}`]) codes.push(f[`B${i}`]);
        }
        console.log(`Solicitando colores para ${codes.length} componentes:`, codes);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/componentes/colores`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ codigos: codes }),
            });
            if (res.ok) {
                const data: ComponentColor[] = await res.json();
                console.log(`Colores de componentes recibidos: ${data.length} componentes`);

                // FETCH DENSIDADES
                const resDens = await fetch(`${API_BASE_URL}/api/componentes/densidades`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
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

                // First pass to parse data and calculate colorants sum
                const parsedData = data.map(cc => {
                    const code = cc.code;
                    let quantity = 0;
                    let isBaseComponent = (code === baseCode);

                    if (!isBaseComponent) {
                        for (let i = 1; i <= 13; i++) {
                            if (f[`C${i}`] === code) { quantity = normalizeDecimal(f[`Q${i}`] || '0'); break; }
                        }
                        if (quantity === 0) {
                            for (let i = 1; i <= 6; i++) {
                                if (f[`A${i}`] === code) { quantity = normalizeDecimal(f[`AQ${i}`] || '0'); break; }
                            }
                        }
                        if (quantity === 0) {
                            for (let i = 1; i <= 5; i++) {
                                if (f[`B${i}`] === code) { quantity = normalizeDecimal(f[`BQ${i}`] || '0'); break; }
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

                console.log('Colores de componentes procesados (con densidades):', enrichedData);

                setComponentColors(enrichedData);
            }
        } catch (err) {
            console.error('Error fetching component colors:', err);
        } finally {
            setLoadingComponents(false);
        }
    };

    // Auto-update AI context when selection or colors change
    useEffect(() => {
        if (!selectedMatch || componentColors.length === 0) return;

        const f = selectedMatch.formula;
        const l = parseFloat(patronL);
        const a = parseFloat(patronA);
        const b = parseFloat(patronB);

        const currentSampleL = sampleL ? parseFloat(sampleL) : parseFloat(f.L || '0');
        const currentSampleA = sampleA ? parseFloat(sampleA) : parseFloat(f.A || '0');
        const currentSampleB = sampleB ? parseFloat(sampleB) : parseFloat(f.B || '0');
        const currentDe = sampleDe !== null ? sampleDe : selectedMatch.deltaE;

        const qcContext = {
            standard: {
                l, a, b,
                hex: labToHex(l, a, b),
                name: 'Patrón (Búsqueda de Color)',
            },
            sample: {
                l: currentSampleL,
                a: currentSampleA,
                b: currentSampleB,
                hex: sampleL ? labToHex(currentSampleL, currentSampleA, currentSampleB) : selectedMatch.hex,
                name: sampleL ? 'Muestra Ajustada (Nueva Lectura)' : (f.NOMBREFORMULA || f.NOMBRE || 'Fórmula Encontrada'),
            },
            dL: (currentSampleL - l).toFixed(2),
            dA: (currentSampleA - a).toFixed(2),
            dB: (currentSampleB - b).toFixed(2),
            de: currentDe.toFixed(2),
            formulaSource: selectedMatch.source,
            componentColors: componentColors.map(cc => {
                const totalQty = (cc.ml || 0) * (normalizeDecimal(prepareAmount) || 1.0);
                return {
                    code: cc.code,
                    color: cc.rgb,
                    isBase: cc.isBase,
                    baseType: cc.baseType,
                    quantity: cc.quantity, // Gramos por kilo (fórmula base)
                    calculatedQuantity: cc.calculatedQuantity ? cc.calculatedQuantity : Math.round(totalQty * 100) / 100, // Gramos totales para el volumen
                };
            }),
            timestamp: new Date().toISOString(),
            isMatchMode: true,
            prepareAmount: normalizeDecimal(prepareAmount),
            lote: currentLote,
            technicalLog: technicalLog
        };

        localStorage.setItem('qc_context', JSON.stringify(qcContext));
        window.dispatchEvent(new CustomEvent('qc-context-updated'));
    }, [selectedMatch, componentColors, patronL, patronA, patronB, prepareAmount, sampleL, sampleA, sampleB, sampleDe]);

    // ----------------------------------------------------------------
    // Send to Quality Control
    // ----------------------------------------------------------------
    const handleSendToQC = () => {
        if (!selectedMatch) return;
        const f = selectedMatch.formula;
        const l = parseFloat(patronL);
        const a = parseFloat(patronA);
        const b = parseFloat(patronB);

        // Build QC context with component colors for AI
        const qcContext = {
            standard: {
                l, a, b,
                hex: labToHex(l, a, b),
                name: 'Patrón (Búsqueda de Color)',
            },
            sample: {
                l: parseFloat(f.L || '0'),
                a: parseFloat(f.A || '0'),
                b: parseFloat(f.B || '0'),
                hex: selectedMatch.hex,
                name: f.NOMBREFORMULA || f.NOMBRE || 'Fórmula Encontrada',
            },
            dL: (parseFloat(f.L || '0') - l).toFixed(2),
            dA: (parseFloat(f.A || '0') - a).toFixed(2),
            dB: (parseFloat(f.B || '0') - b).toFixed(2),
            de: selectedMatch.deltaE.toFixed(2),
            formulaSource: selectedMatch.source,
            formulaName: f.NOMBREFORMULA || f.NOMBRE || 'Fórmula Encontrada',
            formulaProduct: f.LINEA_DEL_PRODUCTO || f.TIPO || 'Producto no especificado',
            prepareAmount,
            componentColors: componentColors.map(cc => ({
                code: cc.code,
                color: cc.rgb,
                isBase: cc.isBase,
                baseType: cc.baseType,
                quantity: cc.ml ? cc.ml / 1000 : (cc.quantity || 0) / 1000, // assuming ml or g. litters = ml / 1000
                displayQuantity: (((cc.ml || 0) * (normalizeDecimal(prepareAmount) || 0)).toFixed(2)) + 'g'
            })),
            timestamp: new Date().toISOString(),
        };

        localStorage.setItem('qc_context', JSON.stringify(qcContext));

        navigate('/quality-control', {
            state: {
                standardFromFormula: {
                    l, a, b,
                    name: 'Patrón (Búsqueda de Color)',
                },
                sampleFromQC: {
                    l: parseFloat(f.L || '0'),
                    a: parseFloat(f.A || '0'),
                    b: parseFloat(f.B || '0'),
                    hex: selectedMatch.hex,
                    name: f.NOMBREFORMULA || f.NOMBRE || 'Fórmula Encontrada',
                },
            },
        });
    };

    const handleSaveTechnicalSession = async () => {
        if (!selectedMatch) return;

        const f = selectedMatch.formula;
        const body = {
            formulaName: f.NOMBREFORMULA || f.NOMBRE || 'Fórmula sin nombre',
            formulaCode: f.CODIGO || '',
            lote: currentLote,
            history: technicalLog,
            source: selectedMatch.source,
            originalFormulaId: f.id || f.ID,
            currentLab: {
                l: sampleL ? parseFloat(sampleL) : parseFloat(f.L || '0'),
                a: sampleA ? parseFloat(sampleA) : parseFloat(f.A || '0'),
                b: sampleB ? parseFloat(sampleB) : parseFloat(f.B || '0'),
            },
            currentDeltaE: sampleDe !== null ? sampleDe : selectedMatch.deltaE,
            componentQuantities: componentColors.map(cc => ({
                code: cc.code,
                calculatedQuantity: cc.calculatedQuantity || 0
            }))
        };

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/ajustes/guardar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                alert('¡Ciclo técnico guardado con éxito!');
            } else {
                const err = await res.json();
                alert(`Error al guardar: ${err.error}`);
            }
        } catch (error) {
            console.error('Error saving technical session:', error);
            alert('Error de conexión al guardar el ciclo técnico.');
        }
    };

    const handleConsultHistory = async () => {
        if (!currentLote) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/ajustes/historial/${currentLote}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setHistoryItems(data);
                setShowHistoryModal(true);
            }
        } catch (e) {
            console.error("Error fetching history", e);
        }
    };

    // ----------------------------------------------------------------
    // Render
    // ----------------------------------------------------------------
    return (
        <div className="min-h-screen bg-[#0A0F14] text-slate-200 font-sans flex flex-col">
            {/* Header */}
            <header className="fixed top-0 z-10 flex w-full items-center justify-between border-b border-slate-800 bg-[#0A0F14]/80 backdrop-blur-md px-4 py-4">
                <button onClick={() => navigate('/')} className="p-2 text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <h1 className="text-lg font-semibold uppercase tracking-tight flex items-center gap-2">
                    <Target className="h-5 w-5 text-violet-400" />
                    Búsqueda de Color
                </h1>
                <div className="w-10" />
            </header>

            <main className="flex flex-col gap-4 pt-24 pb-8 px-4 max-w-lg mx-auto w-full flex-grow">
                {/* ========================== */}
                {/* Patron Input               */}
                {/* ========================== */}
                {/* ========================== */}
                {/* Patron Input & Search      */}
                {/* ========================== */}
                {!selectedMatch && (
                    <>
                        <div className="space-y-3">
                            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                Color a Buscar (Patrón)
                            </h2>

                            {/* Preview Swatch */}
                            <div className="flex items-center gap-4">
                                <div
                                    className="h-20 w-20 rounded-2xl border-2 border-slate-700 shadow-2xl transition-colors flex items-center justify-center flex-shrink-0 overflow-hidden"
                                    style={{ backgroundColor: patronHex || '#111' }}
                                >
                                    {!patronHex && (
                                        <Target className="h-6 w-6 text-slate-700" />
                                    )}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-bold text-white">
                                        {patronHex ? 'Vista previa del color' : 'Ingresa valores L*a*b*'}
                                    </p>
                                    {patronHex && (
                                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                                            L: {parseFloat(patronL).toFixed(2)} | a: {parseFloat(patronA).toFixed(2)} | b: {parseFloat(patronB).toFixed(2)}
                                        </p>
                                    )}
                                    <p className="text-[10px] text-slate-600">{patronHex || '#------'}</p>
                                </div>
                            </div>

                            {/* Mode Selector */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setInputMode('manual')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${inputMode === 'manual'
                                        ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'
                                        }`}
                                >
                                    <Keyboard className="h-3.5 w-3.5" />
                                    Manual
                                </button>
                                <button
                                    onClick={() => {
                                        setInputMode('device');
                                        handleDeviceCapture();
                                    }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${inputMode === 'device'
                                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'
                                        }`}
                                >
                                    <Scan className="h-3.5 w-3.5" />
                                    Dispositivo
                                </button>
                            </div>

                            {/* Manual LAB inputs */}
                            <AnimatePresence>
                                {inputMode === 'manual' && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="grid grid-cols-3 gap-3 pt-2">
                                            {[
                                                { label: 'L*', value: patronL, setter: setPatronL, accent: 'text-white', border: 'focus:border-white/30' },
                                                { label: 'a*', value: patronA, setter: setPatronA, accent: 'text-emerald-400', border: 'focus:border-emerald-500/50' },
                                                { label: 'b*', value: patronB, setter: setPatronB, accent: 'text-amber-400', border: 'focus:border-amber-500/50' },
                                            ].map((field) => (
                                                <div key={field.label} className="flex flex-col gap-1">
                                                    <label className={`text-[10px] font-bold uppercase tracking-widest ml-1 ${field.accent}`}>
                                                        {field.label}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={field.value}
                                                        onChange={(e) => field.setter(e.target.value)}
                                                        placeholder="0.00"
                                                        className={`w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-3 text-center text-sm font-mono text-white outline-none transition-all ${field.border}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Results count selector */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 flex-1">
                                <Sliders className="h-3.5 w-3.5 text-slate-500" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resultados:</span>
                            </div>
                            <div className="flex gap-1.5">
                                {[5, 10, 20, 50].map((n) => (
                                    <button
                                        key={n}
                                        onClick={() => setMaxResults(n)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${maxResults === n
                                            ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/30'
                                            : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'
                                            }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search Button */}
                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={handleSearch}
                            disabled={!patronHex || isSearching}
                            className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl ${patronHex && !isSearching
                                ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-violet-900/30 active:shadow-none'
                                : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                                }`}
                        >
                            {isSearching ? (
                                <>
                                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                    Buscando coincidencias...
                                </>
                            ) : (
                                <>
                                    <Search className="h-4 w-4" />
                                    Buscar Fórmulas Cercanas
                                </>
                            )}
                        </motion.button>
                    </>
                )}


                {/* ========================== */}
                {/* Results List               */}
                {/* ========================== */}
                <AnimatePresence>
                    {hasSearched && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3"
                        >
                            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                {searchResults.length > 0
                                    ? `${searchResults.length} fórmulas más cercanas`
                                    : 'No se encontraron coincidencias'}
                            </h2>

                            {searchResults.map((match, index) => {
                                // Hide other formulas when one is selected
                                if (selectedMatch && selectedMatch !== match) {
                                    return null;
                                }
                                const isSelected = selectedMatch === match;
                                return (
                                    <motion.div
                                        key={`${match.source}-${match.formula.id || match.formula.ID}-${index}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.04 }}
                                        onClick={() => handleSelectMatch(match)}
                                        className={`rounded-2xl border overflow-hidden cursor-pointer transition-all active:scale-[0.98] ${isSelected
                                            ? 'border-violet-500/50 bg-violet-950/20 shadow-lg shadow-violet-900/10'
                                            : 'border-slate-800 bg-slate-900/40 hover:border-slate-600'
                                            }`}
                                    >
                                        <div className="flex">
                                            {/* Color swatch */}
                                            <div
                                                className="w-16 min-w-[4rem] border-r border-slate-800/50"
                                                style={{ backgroundColor: match.hex }}
                                            />
                                            <div className="flex-1 p-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="min-w-0">
                                                        <h3 className="text-sm font-bold text-white truncate">
                                                            {match.formula.NOMBREFORMULA || match.formula.NOMBRE || 'Sin nombre'}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase border ${match.source === 'standard'
                                                                ? 'bg-blue-900/30 text-blue-400 border-blue-800/50'
                                                                : 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50'
                                                                }`}>
                                                                {match.source === 'standard' ? 'Standard' : 'Personal'}
                                                            </span>
                                                            {match.formula.CODIGO && (
                                                                <span className="text-[8px] text-slate-600 font-mono">
                                                                    {match.formula.CODIGO}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0 ml-3">
                                                        <span className={`text-lg font-mono font-black ${match.deltaE < 1 ? 'text-green-400' : match.deltaE < 3 ? 'text-amber-400' : 'text-red-400'
                                                            }`}>
                                                            {match.deltaE.toFixed(2)}
                                                        </span>
                                                        <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">ΔE 2000</p>
                                                    </div>
                                                </div>
                                                {/* LAB values */}
                                                <div className="flex gap-3 mt-2">
                                                    <span className="text-[9px] text-slate-500 font-mono">L:{parseFloat(match.formula.L || '0').toFixed(1)}</span>
                                                    <span className="text-[9px] text-emerald-600 font-mono">a:{parseFloat(match.formula.A || '0').toFixed(1)}</span>
                                                    <span className="text-[9px] text-amber-600 font-mono">b:{parseFloat(match.formula.B || '0').toFixed(1)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Rank badge */}
                                        <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-slate-950/80 border border-slate-700 flex items-center justify-center">
                                            <span className="text-[9px] font-bold text-slate-400">{index + 1}</span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ========================== */}
                {/* Selected Formula Detail    */}
                {/* ========================== */}
                <AnimatePresence>
                    {selectedMatch && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="space-y-4"
                        >
                            {/* Comparison Bar */}
                            <div className="w-full h-16 rounded-2xl overflow-hidden relative flex border border-slate-800">
                                <div
                                    className="w-1/2 relative flex items-start justify-center pt-1"
                                    style={{ backgroundColor: patronHex || '#111' }}
                                >
                                    <span className="text-[8px] font-black text-white px-2 py-0.5 rounded-full bg-black/20 uppercase tracking-widest">Patrón</span>
                                </div>
                                <div
                                    className="w-1/2 relative flex items-start justify-center pt-1 border-l border-white/20"
                                    style={{ backgroundColor: selectedMatch.hex }}
                                >
                                    <span className="text-[8px] font-black text-white px-2 py-0.5 rounded-full bg-black/20 uppercase tracking-widest">Fórmula</span>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="bg-white rounded-full px-4 py-1 text-[11px] font-black border-2 border-black shadow-lg text-black">
                                        ΔE: {selectedMatch.deltaE.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            {/* Technical Log Info */}
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                                        <Layers className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lote de Trabajo</p>
                                        <p className="text-sm font-mono font-bold text-white uppercase">{currentLote}</p>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-1">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estado</p>
                                    <button
                                        onClick={handleConsultHistory}
                                        className="px-3 py-1 bg-violet-600/20 border border-violet-500/30 rounded-lg text-[10px] font-bold text-violet-300 hover:bg-violet-600/40 transition-all flex items-center gap-1.5"
                                    >
                                        <Search className="h-3 w-3" />
                                        Ver Historial
                                    </button>
                                </div>
                            </div>

                            {/* Quantity Input */}
                            <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Layers className="h-3.5 w-3.5 text-blue-400" />
                                        Cantidad a Preparar
                                    </h3>
                                    <span className="text-[10px] font-bold text-blue-400 uppercase">Litros (LT)</span>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={prepareAmount}
                                        onChange={(e) => setPrepareAmount(e.target.value)}
                                        onBlur={() => {
                                            const val = normalizeDecimal(prepareAmount);
                                            if (val <= 0) setPrepareAmount(1.0);
                                        }}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 px-4 text-center text-xl font-mono font-black text-white outline-none focus:border-blue-500/50 transition-all"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">LT</span>
                                    </div>
                                </div>
                            </div>

                            {/* Component Colors */}
                            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Beaker className="h-3.5 w-3.5 text-violet-400" />
                                        Componentes de la Fórmula
                                    </h3>
                                    <button onClick={() => {
                                        setSelectedMatch(null);
                                        setComponentColors([]);
                                        setPrepareAmount(1.0);
                                    }} className="text-[10px] text-slate-400 hover:text-white transition-colors">
                                        <span className="mr-1">←</span> Volver a resultados
                                    </button>
                                </div>
                                {loadingComponents ? (
                                    <div className="flex items-center gap-3 py-4 justify-center">
                                        <div className="h-4 w-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">Cargando componentes...</span>
                                    </div>
                                ) : componentColors.length > 0 ? (
                                    <div className="space-y-2">
                                        {componentColors.map((cc, idx) => (
                                            <div key={idx} className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-xl">
                                                <div
                                                    className={`h-8 w-8 rounded-lg flex-shrink-0 shadow-inner`}
                                                    style={{
                                                        backgroundColor: cc.baseType === 'white' ? '#ffffff' : cc.baseType === 'transparent' ? '#ffffff' : (cc.rgb || '#555'),
                                                        backgroundImage: cc.baseType === 'transparent'
                                                            ? 'linear-gradient(45deg, #aaa 25%, transparent 25%), linear-gradient(-45deg, #aaa 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #aaa 75%), linear-gradient(-45deg, transparent 75%, #aaa 75%)'
                                                            : undefined,
                                                        backgroundSize: cc.baseType === 'transparent' ? '8px 8px' : undefined,
                                                        backgroundPosition: cc.baseType === 'transparent' ? '0 0, 0 4px, 4px -4px, -4px 0px' : undefined,
                                                    }}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-bold text-white truncate">{cc.code}</p>
                                                    <p className={`text-[8px] font-bold uppercase ${cc.isBase ? 'text-blue-400' : 'text-violet-400'}`}>
                                                        {cc.isBase
                                                            ? cc.baseType === 'white' ? 'Base Blanca'
                                                                : cc.baseType === 'transparent' ? 'Base Transparente'
                                                                    : 'Base'
                                                            : 'Colorante'
                                                        }
                                                    </p>
                                                </div>
                                                <div className="text-[9px] font-bold text-slate-300 text-right">
                                                    {cc.calculatedQuantity !== undefined
                                                        ? cc.calculatedQuantity.toFixed(2)
                                                        : (((cc.ml || 0) * (normalizeDecimal(prepareAmount) || 0)).toFixed(2))
                                                    }g
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-600 italic text-center py-2">Sin información de color para los componentes.</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleSaveTechnicalSession}
                                    className="flex items-center justify-center gap-3 py-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs uppercase tracking-widest shadow-xl active:shadow-none transition-all hover:bg-slate-700 hover:text-white"
                                >
                                    <Check className="h-4 w-4 text-emerald-400" />
                                    Guardar Registro
                                </motion.button>

                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleSendToQC}
                                    className="flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-emerald-900/30 active:shadow-none transition-all"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    Enviar a QC
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Loading overlay */}
            <AnimatePresence>
                {isMeasuring && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0A0F14]/90 backdrop-blur-sm"
                    >
                        <div className="relative mb-6">
                            <div className="h-20 w-20 rounded-full border-4 border-violet-500/20" />
                            <div className="absolute top-0 left-0 h-20 w-20 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
                        </div>
                        <h3 className="text-xl font-bold text-white tracking-tight">Capturando Color...</h3>
                        <p className="text-slate-400 text-sm mt-2 font-medium uppercase tracking-widest animate-pulse">Leyendo valores del sensor</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal de Nueva Lectura después de sugerencia IA */}
            <AnimatePresence>
                {showReadingModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0F14]/90 backdrop-blur-md px-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center"
                        >
                            <div className="h-16 w-16 bg-violet-600/20 rounded-2xl flex items-center justify-center mb-6 border border-violet-500/30">
                                <Scan className="h-8 w-8 text-violet-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Ajuste técnico aplicado</h3>
                            <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                                He agregado los pigmentos sugeridos por la IA a la mezcla. ¿Deseas realizar una nueva lectura con el dispositivo para verificar el nuevo Delta E?
                            </p>

                            <div className="flex flex-col w-full gap-3">
                                <button
                                    onClick={() => handlePerformNewReading()}
                                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-violet-900/30 active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    Aceptar hacer la lectura
                                </button>
                                <button
                                    onClick={() => setShowReadingModal(false)}
                                    className="w-full py-4 rounded-2xl bg-slate-800 text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal de Historial de Ajustes */}
            <AnimatePresence>
                {showHistoryModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0A0F14]/95 backdrop-blur-xl px-4 py-8"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl flex flex-col max-h-full overflow-hidden"
                        >
                            {/* Header Modal */}
                            <div className="p-6 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                                <div>
                                    <h3 className="text-xl font-bold text-white tracking-tight uppercase">Historial de Ajustes</h3>
                                    <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-1">Lote: {currentLote}</p>
                                </div>
                                <button
                                    onClick={() => setShowHistoryModal(false)}
                                    className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 hover:text-white transition-all border border-slate-700"
                                >
                                    <ArrowLeft className="h-5 w-5 rotate-90 sm:rotate-0" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {historyItems.length === 0 ? (
                                    <div className="py-20 text-center flex flex-col items-center gap-4">
                                        <div className="h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 opacity-20">
                                            <Search className="h-8 w-8" />
                                        </div>
                                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">No hay registros para este lote</p>
                                    </div>
                                ) : (
                                    historyItems.map((item, idx) => {
                                        const type = item.tipo_paso;
                                        const date = new Date(item.fecha).toLocaleString();
                                        const data = item.datos || {};

                                        return (
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                key={item.id || idx}
                                                className="bg-slate-950 border border-slate-800/50 rounded-3xl p-5 relative overflow-hidden"
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-10 w-10 rounded-2xl flex items-center justify-center border ${type === 'INICIO' ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' :
                                                            type === 'ADICION' ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400' :
                                                                type === 'LECTURA_PATRON' ? 'bg-amber-600/10 border-amber-500/30 text-amber-400' :
                                                                    'bg-violet-600/10 border-violet-500/30 text-violet-400'
                                                            }`}>
                                                            {type === 'INICIO' ? <Target className="h-5 w-5" /> :
                                                                type === 'ADICION' ? <Beaker className="h-5 w-5" /> :
                                                                    type === 'LECTURA_PATRON' ? <Search className="h-5 w-5" /> :
                                                                        <Scan className="h-5 w-5" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{type}</p>
                                                            <p className="text-[10px] font-bold text-slate-600">{date}</p>
                                                        </div>
                                                    </div>
                                                    {data.de !== undefined && (
                                                        <div className="px-3 py-1 bg-white rounded-full text-[10px] font-black text-black">
                                                            ΔE: {parseFloat(data.de).toFixed(2)}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    {type === 'ADICION' && data.suggestions && (
                                                        <div className="space-y-1.5">
                                                            {data.suggestions.map((s: any, i: number) => (
                                                                <div key={i} className="flex items-center justify-between text-[11px] font-bold">
                                                                    <span className="text-slate-300 flex items-center gap-2">
                                                                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color || '#fff' }} />
                                                                        {s.code}
                                                                    </span>
                                                                    <span className="text-emerald-400">+{s.quantity}g</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {(type === 'MEDICION' || type === 'LECTURA_PATRON') && (
                                                        <div className="grid grid-cols-3 gap-2 pt-1">
                                                            <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-center">
                                                                <p className="text-[8px] text-slate-500 uppercase font-bold">L*</p>
                                                                <p className="text-xs font-mono font-bold text-white">{parseFloat(data.l).toFixed(2)}</p>
                                                            </div>
                                                            <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-center">
                                                                <p className="text-[8px] text-slate-500 uppercase font-bold text-emerald-400">a*</p>
                                                                <p className="text-xs font-mono font-bold text-emerald-400">{parseFloat(data.a).toFixed(2)}</p>
                                                            </div>
                                                            <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-center">
                                                                <p className="text-[8px] text-slate-500 uppercase font-bold text-blue-400">b*</p>
                                                                <p className="text-xs font-mono font-bold text-blue-400">{parseFloat(data.b).toFixed(2)}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {type === 'INICIO' && (
                                                        <p className="text-[11px] text-slate-400 font-medium">Búsqueda inicial: ΔE {parseFloat(data.initialDeltaE).toFixed(2)}</p>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 flex-shrink-0">
                                <button
                                    onClick={() => setShowHistoryModal(false)}
                                    className="w-full py-4 rounded-3xl bg-slate-800 text-white font-bold text-xs uppercase tracking-widest border border-slate-700 active:scale-95 transition-all"
                                >
                                    Cerrar Ventana
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
