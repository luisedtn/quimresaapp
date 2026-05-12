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
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export default function ColorMatch() {
    const navigate = useNavigate();
    const { isConnected, measure, isMeasuring } = useNixDevice();

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
            setPatronL(result.color.L.toString());
            setPatronA(result.color.a.toString());
            setPatronB(result.color.b.toString());
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
                // data already sorted by deltaE from backend
                setSearchResults(data.map(d => ({
                    ...d,
                    hex: labToHex(
                        parseFloat(d.formula.L || '0'),
                        parseFloat(d.formula.A || '0'),
                        parseFloat(d.formula.B || '0'),
                    ),
                })));
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
        setSelectedMatch(match);
        setLoadingComponents(true);

        const f = match.formula;
        // Collect component codes
        const codes: string[] = [];
        const baseCode = f.BASE || f.RESERVA || f.CBASE;
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
                const data = await res.json();
                setComponentColors(data);
            }
        } catch (err) {
            console.error('Error fetching component colors:', err);
        } finally {
            setLoadingComponents(false);
        }
    };

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
            componentColors: componentColors.map(cc => ({
                code: cc.code,
                color: cc.rgb,
                isBase: cc.isBase,
                baseType: cc.baseType,
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
                                    className="w-1/2"
                                    style={{ backgroundColor: patronHex || '#111' }}
                                />
                                <div
                                    className="w-1/2"
                                    style={{ backgroundColor: selectedMatch.hex }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="bg-white rounded-full px-4 py-1 text-[11px] font-black border-2 border-black shadow-lg">
                                        ΔE: {selectedMatch.deltaE.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            {/* Component Colors */}
                            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 space-y-3">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Beaker className="h-3.5 w-3.5 text-violet-400" />
                                    Componentes de la Fórmula
                                </h3>
                                {loadingComponents ? (
                                    <div className="flex items-center gap-3 py-4 justify-center">
                                        <div className="h-4 w-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">Cargando componentes...</span>
                                    </div>
                                ) : componentColors.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {componentColors.map((cc, idx) => (
                                            <div key={idx} className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/50">
                                                <div
                                                    className={`h-8 w-8 rounded-lg flex-shrink-0 shadow-inner border-2 ${cc.isBase ? 'border-blue-500/60' : 'border-violet-500/60'}`}
                                                    style={{
                                                        backgroundColor: cc.baseType === 'transparent' ? '#fff' : (cc.rgb || '#555'),
                                                        backgroundImage: cc.baseType === 'transparent'
                                                            ? 'linear-gradient(45deg, #aaa 25%, transparent 25%), linear-gradient(-45deg, #aaa 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #aaa 75%), linear-gradient(-45deg, transparent 75%, #aaa 75%)'
                                                            : undefined,
                                                        backgroundSize: cc.baseType === 'transparent' ? '8px 8px' : undefined,
                                                        backgroundPosition: cc.baseType === 'transparent' ? '0 0, 0 4px, 4px -4px, -4px 0px' : undefined,
                                                    }}
                                                />
                                                <div className="min-w-0">
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
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-600 italic text-center py-2">Sin información de color para los componentes.</p>
                                )}
                            </div>

                            {/* Send to QC Button */}
                            <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={handleSendToQC}
                                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-emerald-900/30 active:shadow-none transition-all"
                            >
                                <Sparkles className="h-4 w-4" />
                                Enviar a Control de Calidad
                            </motion.button>
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
        </div>
    );
}
