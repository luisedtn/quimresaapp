import { motion, AnimatePresence } from 'motion/react';
import { X, Beaker, Tag, User, Calendar, Info, Layers, Droplets, ChevronRight, MessageSquare, ClipboardList, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

interface DetalleFormulaProps {
    formula: any;
    isOpen: boolean;
    onClose: () => void;
}

export default function DetalleFormula({ formula, isOpen, onClose }: DetalleFormulaProps) {
    const [activeTab, setActiveTab] = useState<'mezcla' | 'lab' | 'procesos' | 'obs'>('mezcla');
    const [densities, setDensities] = useState<Record<string, number>>({});
    const [calculating, setCalculating] = useState(false);

    useEffect(() => {
        if (!isOpen || !formula) return;

        const fetchDensities = async () => {
            setCalculating(true);
            const codes = new Set<string>();

            // Identificar Código de la Base
            // En Standard: puede ser el nombre (PRODUCTO) o el ID
            console.log("FORMULAPRODUCTO", formula, formula.producto)
            const baseCodeName = formula.RESERVA;
            const baseId = formula.RESERVA;
            const baseCodePersonal = formula.CBASE;

            if (baseCodeName) {
                codes.add(baseCodeName);
            } else {
                if (baseId) {
                    codes.add(baseId);
                } else {
                    if (baseCodePersonal) codes.add(baseCodePersonal);
                }
            }

            for (let i = 1; i <= 13; i++) {
                const cCode = formula[`C${i}`];
                if (cCode) codes.add(cCode);
            }
            for (let i = 1; i <= 6; i++) {
                const aCode = formula[`A${i}`];
                if (aCode) codes.add(aCode);
            }
            for (let i = 1; i <= 2; i++) {
                const bCode = formula[`B${i}`];
                if (bCode) codes.add(bCode);
            }

            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE_URL}/api/componentes/densidades`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ codigos: Array.from(codes) })
                });

                if (res.ok) {
                    const data = await res.json();
                    const densityMap: Record<string, number> = {};
                    data.forEach((item: any) => {
                        densityMap[item.CODIGO] = item.DENSIDAD || 1.0;
                    });
                    setDensities(densityMap);
                }
            } catch (err) {
                console.error("Error fetching densities:", err);
            } finally {
                setCalculating(false);
            }
        };

        fetchDensities();
    }, [isOpen, formula]);

    if (!formula) return null;

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    // --- CÁLCULOS DE VOLUMEN Y DENSIDAD (Física Real) ---

    const rawIngredients: any[] = [];
    console.log("DENSIDADES DE TODOS LOS ELEMENTOS", densities)
    // 1. Identificar Base
    const baseCodeName = formula.RESERVA;
    const baseId = formula.IDPRODUCTO?.toString();
    const baseCodePersonal = formula.CBASE;

    // Seleccionar el código que realmente tenga densidad en el mapa, o el nombre por defecto
    const baseCode = (baseCodeName && densities[baseCodeName]) ? baseCodeName :
        (baseId && densities[baseId]) ? baseId :
            (baseCodePersonal && densities[baseCodePersonal]) ? baseCodePersonal :
                (baseCodeName || baseCodePersonal || baseId);


    const baseMass = parseFloat(formula.BASE || formula.QBASE || '0');
    console.log("FORMULARECIBIDA", formula);
    console.log("BASE RECIBIDA", baseCode, baseMass);
    if (baseCode && baseMass > 0) {
        rawIngredients.push({ code: baseCode, mass: baseMass, type: 'BASE' });
    }

    // 2. Colorantes
    for (let i = 1; i <= 13; i++) {
        const code = formula[`C${i}`];
        const mass = parseFloat(formula[`Q${i}`] || '0');
        if (code && mass > 0) {
            rawIngredients.push({ code, mass, type: 'COLORANTE' });
        }
    }
    // 3. Aditivos A
    for (let i = 1; i <= 6; i++) {
        const code = formula[`A${i}`];
        const mass = parseFloat(formula[`AQ${i}`] || '0');
        if (code && mass > 0) {
            rawIngredients.push({ code, mass, type: 'ADITIVO A' });
        }
    }
    // 4. Aditivos B
    for (let i = 1; i <= 2; i++) {
        const code = formula[`B${i}`];
        const mass = parseFloat(formula[`BQ${i}`] || '0');
        if (code && mass > 0) {
            rawIngredients.push({ code, mass, type: 'ADITIVO B' });
        }
    }




    // CÁLCULO DE DENSIDAD DE MEZCLA Y VOLUMEN TOTAL
    // Densidad = Masa / Volumen
    // Volumen Total = Sumatoria(Masa_i / Densidad_i)

    let totalRawMass = 0;
    let totalRawVolume = 0;

    console.log(`[DENSIDAD] --- INICIO CÁLCULO PASO A PASO ---`);
    console.log(`[DENSIDAD] Objetivo: rho_mix = Sum(Masas) / Sum(Masas/Densidades)`);

    const totalMass = rawIngredients.reduce((accumulator, ing) => {
        return accumulator + (ing.mass || 0);
    }, 0);

    console.log(`Masa Total Acumulada: ${totalMass.toFixed(2)} g`);
    rawIngredients[0].mass = 1000 - (totalMass - baseMass);

    const ingredientsWithPhysics = rawIngredients.map((ing, index) => {
        const rho = densities[ing.code] || 1.0;
        const vol = ing.mass / rho;

        const prevMass = totalRawMass;
        const prevVol = totalRawVolume;

        totalRawMass += ing.mass;
        totalRawVolume += vol;

        console.log(`[DENSIDAD] Paso ${index + 1}: Componente ${ing.code}`);
        console.log(`  > Masa: ${ing.mass} g`);
        console.log(`  > Densidad Elemento: ${rho}`);
        console.log(`  > Cociente (M/D): ${ing.mass} / ${rho} = ${vol.toFixed(4)} ml`);
        console.log(`  > Suma Acumulada: Masa=${totalRawMass.toFixed(2)}g, Vol=${totalRawVolume.toFixed(2)}ml`);

        return { ...ing, rho, vol };
    });

    const calculatedMixtureDensity = totalRawVolume > 0 ? (totalRawMass / totalRawVolume) : 1.0;
    console.log(`[DENSIDAD] RESULTADO FINAL: ${totalRawMass.toFixed(2)} / ${totalRawVolume.toFixed(2)} = ${calculatedMixtureDensity.toFixed(4)}`);

    // Factor de escala para formar exactamente 1000 ml
    const volumeFactor = calculatedMixtureDensity
    //totalRawVolume > 0 ? 1000 / totalRawVolume : 1;
    console.log(`[DENSIDAD] Factor de volumen para 1 litro: 1000 / ${totalRawVolume.toFixed(2)} = ${volumeFactor.toFixed(4)}`);

    // Cantidades finales para el usuario (Escaladas a 1 Litro)
    let finalMassSum = 0;
    const processedIngredients = ingredientsWithPhysics.map(ing => {
        const finalVol = ing.mass * volumeFactor; // Volumen en ml (Suma = 1000)
        //const finalGrams = finalVol * ing.rho;   // Masa en gramos
        finalMassSum += finalVol;

        console.log(`[FINAL] ${ing.code} | ml: ${ing.vol.toFixed(2)} | g: ${finalVol.toFixed(2)}`);

        return {
            ...ing,
            ml: finalVol,
            grams: ing.mass,
            percentage: (finalVol / 10) // (ml / 1000) * 100
        };
    });

    const mixtureDensityDisplay = totalRawVolume > 0 ? (finalMassSum / 1000) : calculatedMixtureDensity;
    console.log(`[CÁLCULO] --- Finalizado. Masa Total: ${finalMassSum.toFixed(2)} g ---`);

    const processes = [
        { id: 1, text: formula.PROCESOS },
        { id: 2, text: formula.PROCESOS2 },
        { id: 3, text: formula.PROCESOS3 },
        { id: 4, text: formula.PROCESOS4 },
    ].filter(p => p.text);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-x-0 bottom-0 z-[70] h-[94vh] w-full overflow-hidden rounded-t-[2.5rem] bg-[#0A0F14] border-t border-slate-800 shadow-2xl flex flex-col"
                    >
                        {/* Handle */}
                        <div className="flex justify-center p-3">
                            <div className="h-1 w-10 rounded-full bg-slate-800" />
                        </div>

                        {/* Header Area */}
                        <div className="px-6 pb-6 pt-2">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div
                                        className="h-14 w-14 rounded-2xl border-2 border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden flex-shrink-0"
                                        style={{ backgroundColor: `lab(${formula.L} ${formula.A} ${formula.B})` }}
                                    >
                                        <div className="h-full w-full bg-gradient-to-tr from-black/20 to-transparent" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-xl font-black text-white leading-tight truncate">{formula.NOMBREFORMULA}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold text-[#c07204] bg-[#c07204]/10 px-2 py-0.5 rounded border border-[#c07204]/20 uppercase tracking-widest">
                                                {formula.CODIGO || 'SIN CÓDIGO'}
                                            </span>
                                            {mixtureDensityDisplay && (
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                    ρ mix: {mixtureDensityDisplay.toFixed(4)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Info Chips Scroller */}
                            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                                <div className="flex-shrink-0 bg-slate-900/50 px-4 py-2 rounded-2xl border border-slate-800/50 flex items-center gap-2">
                                    <User className="h-3 w-3 text-blue-400" />
                                    <p className="text-[10px] text-white font-bold truncate max-w-[120px]">{formula.NOMBRECLI || 'N/A'}</p>
                                </div>
                                <div className="flex-shrink-0 bg-slate-900/50 px-4 py-2 rounded-2xl border border-slate-800/50 flex items-center gap-2">
                                    <Calendar className="h-3 w-3 text-emerald-400" />
                                    <p className="text-[10px] text-white font-bold">{formatDate(formula.FECHA)}</p>
                                </div>
                                <div className="flex-shrink-0 bg-slate-900/50 px-4 py-2 rounded-2xl border border-slate-800/50 flex items-center gap-2">
                                    <Beaker className="h-3 w-3 text-[#c07204]" />
                                    <p className="text-[10px] text-white font-bold">{formula.CANTIDAD || '0'} {formula.UNIDAD || 'LT'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex px-6 border-b border-white/5 bg-slate-950/50 gap-8 overflow-x-auto no-scrollbar">
                            {[
                                { id: 'mezcla', label: 'Fórmula', icon: Droplets },
                                { id: 'lab', label: 'Colorimetría', icon: Activity },
                                { id: 'procesos', label: 'Procesos', icon: ClipboardList },
                                { id: 'obs', label: 'Notas', icon: MessageSquare },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 py-4 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id
                                        ? 'border-[#c07204] text-white font-bold'
                                        : 'border-transparent text-slate-600 hover:text-slate-400'
                                        }`}
                                >
                                    <tab.icon className={`h-3.5 w-3.5 ${activeTab === tab.id ? 'text-[#c07204]' : ''}`} />
                                    <span className="text-[10px] uppercase font-bold tracking-widest">{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div className="flex-grow overflow-y-auto bg-[#070B0F]">
                            {activeTab === 'mezcla' && (
                                <div className="p-6 space-y-6">
                                    {calculating && (
                                        <div className="flex items-center gap-3 bg-[#c07204]/10 p-3 rounded-xl border border-[#c07204]/20 animate-pulse">
                                            <div className="h-4 w-4 rounded-full border-2 border-[#c07204] border-t-transparent animate-spin"></div>
                                            <p className="text-[10px] font-bold text-[#c07204] uppercase tracking-widest">Calculando densidades y volumen...</p>
                                        </div>
                                    )}

                                    {/* Summary row */}
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-2">
                                        <span>Componente | ρ</span>
                                        <div className="flex gap-8">
                                            <span>Mililitros (ml)</span>
                                            <span className="w-16 text-right">Gramos</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {processedIngredients.map((item, index) => (
                                            <div
                                                key={index}
                                                className={`p-4 rounded-3xl border flex flex-col gap-3 transition-all ${item.type === 'BASE'
                                                    ? 'bg-[#c07204]/5 border-[#c07204]/20 shadow-[0_10px_30px_rgba(192,114,4,0.05)]'
                                                    : 'bg-slate-900 border-slate-800'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${item.type === 'BASE' ? 'bg-[#c07204] text-white shadow-lg shadow-[#c07204]/20' : 'bg-slate-800 text-slate-500'
                                                            }`}>
                                                            <Beaker className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-white tracking-tight">{item.code}</p>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{item.type} | ρ {item.rho.toFixed(3)}</p>
                                                                <span className="text-slate-700">•</span>
                                                                <p className="text-[9px] text-blue-400 font-bold uppercase">{item.percentage.toFixed(2)}%</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex items-center gap-6">
                                                        <div>
                                                            <p className={`text-lg font-mono font-bold ${item.type === 'BASE' ? 'text-[#c07204]' : 'text-white'}`}>
                                                                {item.ml.toFixed(2)}
                                                            </p>
                                                        </div>
                                                        <div className="w-16">
                                                            <p className="text-sm font-mono font-bold text-slate-500">
                                                                {item.grams.toFixed(1)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Totals & Metadata */}
                                    <div className="pt-4 space-y-4">
                                        <div className="bg-slate-900/30 p-5 rounded-[2rem] border border-white/5 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Volumen</span>
                                                <span className="text-xl font-mono font-black text-white">1000.00 <span className="text-xs text-slate-500 font-bold ml-1">ml</span></span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Masa Total</span>
                                                <span className="text-lg font-mono font-bold text-slate-400">{finalMassSum.toFixed(1)} <span className="text-xs text-slate-600 font-bold ml-1">g</span></span>
                                            </div>
                                            <div className="h-[1px] w-full bg-white/5" />
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mb-1">Muestras</p>
                                                    <p className="text-xs text-white font-bold">{formula.NOMUESTRAS || '0'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mb-1">Preparación</p>
                                                    <p className="text-xs text-white font-bold">#{formula.VARIANTE || '1'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5">
                                                <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mb-1">Producto</p>
                                                <p className="text-xs text-slate-300 font-medium truncate">{formula.PRODUCTO || 'N/A'}</p>
                                            </div>
                                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5">
                                                <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mb-1">Sustrato</p>
                                                <p className="text-xs text-slate-300 font-medium truncate">{formula.SUSTRATO || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'lab' && (
                                <div className="p-6 space-y-8">
                                    {/* Pattern vs Formula Comparison */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-2">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Comparativa LAB</h4>
                                            <Tag className="h-3.5 w-3.5 text-[#c07204]" />
                                        </div>

                                        <div className="bg-slate-900/40 rounded-[2.5rem] border border-white/5 overflow-hidden">
                                            <div className="grid grid-cols-3 bg-white/5 border-b border-white/5">
                                                <div className="p-4 text-center border-r border-white/5">
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Canal</span>
                                                </div>
                                                <div className="p-4 text-center border-r border-white/5">
                                                    <span className="text-[9px] text-[#c07204] font-bold uppercase tracking-widest">Patrón</span>
                                                </div>
                                                <div className="p-4 text-center">
                                                    <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Fórmula</span>
                                                </div>
                                            </div>
                                            {[
                                                { label: 'L*', p: formula.LO, f: formula.L, color: 'text-white' },
                                                { label: 'a*', p: formula.AO, f: formula.A, color: 'text-emerald-400' },
                                                { label: 'b*', p: formula.BO, f: formula.B, color: 'text-amber-400' },
                                            ].map((row, idx) => (
                                                <div key={idx} className={`grid grid-cols-3 ${idx < 2 ? 'border-b border-white/5' : ''}`}>
                                                    <div className="p-5 text-center border-r border-white/5 bg-slate-950/30">
                                                        <span className="text-sm font-black text-slate-500">{row.label}</span>
                                                    </div>
                                                    <div className="p-5 text-center border-r border-white/5">
                                                        <span className={`text-sm font-mono font-bold ${row.color}`}>{parseFloat(row.p || '0').toFixed(2)}</span>
                                                    </div>
                                                    <div className="p-5 text-center bg-slate-900/20">
                                                        <span className={`text-sm font-mono font-bold ${row.color}`}>{parseFloat(row.f || '0').toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Detailed Deltas */}
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-2">Diferenciales (Delta)</h4>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-slate-900 p-5 rounded-3xl border border-white/5 text-center">
                                                <p className="text-[9px] text-slate-500 font-bold uppercase mb-2">ΔL</p>
                                                <p className={`font-mono text-lg font-bold ${parseFloat(formula.DELTAL || '0') >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {formula.DELTAL || '0.00'}
                                                </p>
                                            </div>
                                            <div className="bg-slate-900 p-5 rounded-3xl border border-white/5 text-center">
                                                <p className="text-[9px] text-slate-500 font-bold uppercase mb-2">Δa</p>
                                                <p className={`font-mono text-lg font-bold ${parseFloat(formula.DELTAA || '0') >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {formula.DELTAA || '0.00'}
                                                </p>
                                            </div>
                                            <div className="bg-slate-900 p-5 rounded-3xl border border-white/5 text-center">
                                                <p className="text-[9px] text-slate-500 font-bold uppercase mb-2">Δb</p>
                                                <p className={`font-mono text-lg font-bold ${parseFloat(formula.DELTAB || '0') >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {formula.DELTAB || '0.00'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Total Delta E */}
                                        <div className="relative group overflow-hidden bg-gradient-to-br from-[#c07204]/20 to-slate-900 p-8 rounded-[3rem] border border-[#c07204]/30 flex flex-col items-center justify-center gap-2 shadow-xl">
                                            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(192,114,4,0.1),transparent)]" />
                                            <div className="h-12 w-12 rounded-2xl bg-[#c07204] flex items-center justify-center text-white shadow-2xl shadow-[#c07204]/40 z-10">
                                                <span className="font-black text-xl">ΔE</span>
                                            </div>
                                            <p className="text-[10px] font-bold text-[#c07204] uppercase tracking-[0.3em] z-10">Diferencia Total</p>
                                            <span className="font-mono text-5xl text-white font-black tracking-tighter drop-shadow-lg z-10">
                                                {formula.DELTA || '0.00'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'procesos' && (
                                <div className="p-6 space-y-6">
                                    {processes.length > 0 ? (
                                        <div className="relative">
                                            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-800" />
                                            <div className="space-y-8">
                                                {processes.map((proc, idx) => (
                                                    <div key={idx} className="relative flex items-start gap-4 pl-12">
                                                        <div className="absolute left-4 top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-[#c07204] bg-[#0A0F14] z-10" />
                                                        <div className="bg-slate-900/60 p-5 rounded-3xl border border-slate-800/50 w-full">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <span className="h-6 w-6 rounded-lg bg-[#c07204]/20 text-[#c07204] text-[10px] font-bold flex items-center justify-center">{proc.id}</span>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paso del Proceso</span>
                                                            </div>
                                                            <p className="text-sm text-slate-300 leading-relaxed font-medium">{proc.text}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-20 text-center">
                                            <ClipboardList className="h-12 w-12 text-slate-800 mx-auto mb-4" />
                                            <p className="text-sm text-slate-600 font-medium italic">No hay procesos definidos.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'obs' && (
                                <div className="p-6 h-full">
                                    {formula.OBSERVACIONES ? (
                                        <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800/60 shadow-inner">
                                            <MessageSquare className="h-6 w-6 text-[#c07204] mb-4 opacity-50" />
                                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line font-medium italic">"{formula.OBSERVACIONES}"</p>
                                        </div>
                                    ) : (
                                        <div className="py-20 text-center">
                                            <MessageSquare className="h-12 w-12 text-slate-800 mx-auto mb-4" />
                                            <p className="text-sm text-slate-600 font-medium italic">No hay observaciones.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-[#0A0F14] border-t border-slate-800">
                            <button onClick={onClose} className="w-full py-4 bg-[#c07204] text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-[#c07204]/20">
                                Cerrar Detalle
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
