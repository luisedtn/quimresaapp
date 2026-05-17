import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, FileText, ChevronRight, Beaker, Target, Scan, Calendar, Hash, ArrowLeft, History } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface AjusteTecnico {
    id: number;
    formula_codigo: string;
    formula_nombre: string;
    lote: string;
    tipo_paso: string;
    descripcion: string;
    datos: any;
    fecha: string;
}

interface HistorialControlProps {
    onClose: () => void;
}

export default function HistorialControl({ onClose }: HistorialControlProps) {
    const [registros, setRegistros] = useState<AjusteTecnico[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStep, setSelectedStep] = useState<AjusteTecnico | null>(null);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        fetchHistorial();
    }, []);

    const fetchHistorial = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/ajustes/todo-historial`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setRegistros(data);
            }
        } catch (error) {
            console.error("Error fetching technical history", error);
        } finally {
            setLoading(false);
        }
    };

    const filtered = registros.filter(r =>
        r.lote.toLowerCase().includes(filter.toLowerCase()) ||
        (r.formula_codigo || '').toLowerCase().includes(filter.toLowerCase()) ||
        (r.formula_nombre || '').toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-start bg-[#0A0F14]/98 backdrop-blur-xl w-full p-4 md:p-8 overflow-y-auto">
            {/* Header */}
            <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] flex items-center justify-between shadow-2xl mb-8 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-violet-600/20 rounded-2xl flex items-center justify-center border border-violet-500/30">
                        <History className="h-6 w-6 text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-tight">Historial de Ajustes Técnicos</h2>
                        <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Registro de auditoría de ColorMatch</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-4 border border-slate-800 bg-slate-800/50 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-95"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Main Content Area */}
            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-0">

                {/* List Section */}
                <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar por lote o fórmula..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-xs text-white placeholder:text-slate-600 outline-none focus:border-violet-500/50 transition-all font-medium"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <div key={i} className="h-24 bg-slate-900/30 rounded-3xl animate-pulse border border-slate-800/50" />
                            ))
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">No se encontraron registros</p>
                            </div>
                        ) : (
                            filtered.map((r, idx) => (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    key={r.id}
                                    onClick={() => setSelectedStep(r)}
                                    className={`p-4 rounded-3xl border transition-all cursor-pointer group ${selectedStep?.id === r.id
                                        ? 'bg-violet-600/10 border-violet-500/40 shadow-lg shadow-violet-900/10'
                                        : 'bg-slate-900/40 border-slate-800/50 hover:border-slate-700'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center border ${r.tipo_paso === 'INICIO' ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' :
                                            r.tipo_paso === 'ADICION' ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400' :
                                                'bg-violet-600/10 border-violet-500/30 text-violet-400'
                                            }`}>
                                            {r.tipo_paso === 'INICIO' ? <Target className="h-4 w-4" /> :
                                                r.tipo_paso === 'ADICION' ? <Beaker className="h-4 w-4" /> :
                                                    <Scan className="h-4 w-4" />}
                                        </div>
                                        <span className="text-[8px] font-black text-slate-500 bg-slate-900 px-2 py-1 rounded-full uppercase">
                                            {new Date(r.fecha).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h4 className="text-[11px] font-black text-white uppercase truncate">{r.formula_nombre || 'Sin nombre'}</h4>
                                    <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">Lote: {r.lote}</p>
                                    <div className="mt-3 flex items-center justify-between">
                                        <p className="text-[9px] font-bold text-violet-400/80 uppercase">{r.tipo_paso}</p>
                                        <ChevronRight className={`h-3 w-3 transition-transform ${selectedStep?.id === r.id ? 'translate-x-1 text-violet-400' : 'text-slate-700'}`} />
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* Details Section */}
                <div className="lg:col-span-8">
                    <AnimatePresence mode="wait">
                        {selectedStep ? (
                            <motion.div
                                key={selectedStep.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-slate-900/50 border border-slate-800 rounded-[3rem] h-full flex flex-col overflow-hidden shadow-2xl shadow-blue-900/5"
                            >
                                <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{selectedStep.formula_nombre}</h3>
                                        <div className="flex gap-4 mt-2">
                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 rounded-full border border-slate-800">
                                                <Hash className="h-3 w-3 text-slate-500" />
                                                <span className="text-[10px] font-bold text-slate-400">{selectedStep.formula_codigo}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 rounded-full border border-slate-800">
                                                <Calendar className="h-3 w-3 text-slate-500" />
                                                <span className="text-[10px] font-bold text-slate-400">{new Date(selectedStep.fecha).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`px-6 py-2 rounded-2xl border text-sm font-black uppercase tracking-widest ${selectedStep.tipo_paso === 'INICIO' ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' :
                                        selectedStep.tipo_paso === 'ADICION' ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400' :
                                            'bg-violet-600/10 border-violet-500/30 text-violet-400'
                                        }`}>
                                        {selectedStep.tipo_paso}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                                    {/* Description Card */}
                                    <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-[2rem] relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-6 opacity-5">
                                            <FileText className="w-24 h-24 text-white" />
                                        </div>
                                        <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Detalle de Operación</h5>
                                        <p className="text-base text-slate-200 font-bold leading-relaxed relative z-10">
                                            {selectedStep.descripcion || 'Sin descripción detallada.'}
                                        </p>
                                    </div>

                                    {/* Data Visualization */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* LAB Values */}
                                        {(selectedStep.datos?.l !== undefined || selectedStep.datos?.initialDeltaE !== undefined) && (
                                            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-[2rem] space-y-4">
                                                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Valores de Color</h5>
                                                {selectedStep.datos?.initialDeltaE !== undefined && (
                                                    <div className="bg-white rounded-2xl p-4 text-center">
                                                        <p className="text-[10px] font-black text-slate-500 uppercase">Delta E Inicial</p>
                                                        <p className="text-3xl font-black text-black">{parseFloat(selectedStep.datos.initialDeltaE).toFixed(2)}</p>
                                                    </div>
                                                )}
                                                {selectedStep.datos?.l !== undefined && (
                                                    <div className="grid grid-cols-3 gap-3 mt-4">
                                                        <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-center">
                                                            <p className="text-[9px] text-slate-500 uppercase font-black mb-1">L*</p>
                                                            <p className="text-sm font-mono font-bold text-white">{parseFloat(selectedStep.datos.l).toFixed(2)}</p>
                                                        </div>
                                                        <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-center">
                                                            <p className="text-[9px] text-slate-500 uppercase font-black mb-1 text-emerald-400">a*</p>
                                                            <p className="text-sm font-mono font-bold text-emerald-400">{parseFloat(selectedStep.datos.a).toFixed(2)}</p>
                                                        </div>
                                                        <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-center">
                                                            <p className="text-[9px] text-slate-500 uppercase font-black mb-1 text-blue-400">b*</p>
                                                            <p className="text-sm font-mono font-bold text-blue-400">{parseFloat(selectedStep.datos.b).toFixed(2)}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedStep.datos?.de !== undefined && (
                                                    <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                                                        <span className="text-[10px] font-black text-slate-500 uppercase">Delta E Verificado</span>
                                                        <span className="text-lg font-black text-violet-400">{parseFloat(selectedStep.datos.de).toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Pigment Additions */}
                                        {selectedStep.tipo_paso === 'ADICION' && selectedStep.datos?.suggestions && (
                                            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-[2rem] space-y-4">
                                                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Adiciones de Calidad</h5>
                                                <div className="space-y-3">
                                                    {selectedStep.datos.suggestions.map((s: any, i: number) => (
                                                        <div key={i} className="flex items-center gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800/50">
                                                            <div className="h-10 w-10 rounded-xl shadow-inner border border-white/10" style={{ backgroundColor: s.color || '#888' }} />
                                                            <div className="flex-1">
                                                                <p className="text-[11px] font-black text-white">{s.code}</p>
                                                                <p className="text-[9px] font-bold text-slate-500 uppercase">Pigmento</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm font-black text-emerald-400">+{s.quantity}g</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center bg-slate-900/30 p-6 rounded-[2rem] border border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse" />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">ID de Auditoría: {selectedStep.id}</span>
                                        </div>
                                        <p className="text-[10px] font-black text-slate-600 uppercase">Lote: {selectedStep.lote}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-900/20 border border-dashed border-slate-800 rounded-[3rem]">
                                <ArrowLeft className="h-12 w-12 text-slate-800 mb-6 animate-bounce-x" />
                                <h3 className="text-xl font-bold text-slate-700 uppercase tracking-tighter">Selecciona un registro</h3>
                                <p className="text-xs text-slate-600 mt-2 max-w-xs">Selecciona un paso del historial en el panel de la izquierda para ver los detalles técnicos completos.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
