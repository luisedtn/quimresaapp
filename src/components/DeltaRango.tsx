import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, Save, Check, Palette, AlertTriangle, Type } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface DeltaRangoProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RangoRow {
  id: number;
  VALOR: number;
  NOMBRE: string;
  COLOR: number;
  COLORTEXTO: number;
}

// ── BGR ↔ HEX conversions (Delphi/Windows BGR integer format) ──
function bgrToHex(bgr: number): string {
  const r = bgr & 0xFF;
  const g = (bgr >> 8) & 0xFF;
  const b = (bgr >> 16) & 0xFF;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function hexToBgr(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (b << 16) | (g << 8) | r;
}

function formatValor(v: number): string {
  if (v >= 999999) return '∞';
  return v.toFixed(1);
}

export default function DeltaRango({ isOpen, onClose }: DeltaRangoProps) {
  const [rangos, setRangos] = useState<RangoRow[]>([]);
  const [editState, setEditState] = useState<Record<number, { NOMBRE: string; colorHex: string; textoHex: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  const userData = localStorage.getItem('userData');
  if (userData) {
    try {
      const parsed = JSON.parse(userData);
      if (parsed.idcliente) headers['x-client-id'] = parsed.idcliente.toString();
    } catch {}
  }

  const fetchRangos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/deltarango`, { headers });
      if (!res.ok) throw new Error('Error al cargar rangos');
      const data: RangoRow[] = await res.json();
      setRangos(data);
      // Initialize edit state from fetched data
      const state: typeof editState = {};
      data.forEach(r => {
        state[r.id] = {
          NOMBRE: r.NOMBRE,
          colorHex: bgrToHex(r.COLOR),
          textoHex: bgrToHex(r.COLORTEXTO),
        };
      });
      setEditState(state);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchRangos();
  }, [isOpen]);

  const handleSave = async (id: number) => {
    const edit = editState[id];
    if (!edit) return;
    setSaving(id);
    setSavedId(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/deltarango/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          NOMBRE: edit.NOMBRE,
          COLOR: hexToBgr(edit.colorHex),
          COLORTEXTO: hexToBgr(edit.textoHex),
        }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      const updated: RangoRow = await res.json();
      setRangos(prev => prev.map(r => r.id === id ? updated : r));
      setSavedId(id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/deltarango/reset`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Error al restaurar');
      const data: RangoRow[] = await res.json();
      setRangos(data);
      const state: typeof editState = {};
      data.forEach(r => {
        state[r.id] = {
          NOMBRE: r.NOMBRE,
          colorHex: bgrToHex(r.COLOR),
          textoHex: bgrToHex(r.COLORTEXTO),
        };
      });
      setEditState(state);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResetting(false);
    }
  };

  const updateEdit = (id: number, field: string, value: string) => {
    setEditState(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

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
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-full max-w-[380px] bg-[#0A0F14] border-r border-slate-800 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-[#a38105] to-[#CC5200] shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Palette className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-xs font-bold text-white uppercase tracking-widest">Rangos de Delta</h2>
              </div>
              <button onClick={onClose} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-4 px-4 space-y-3">
              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs"
                >
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Loading */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#a38105] border-t-transparent" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">Cargando rangos…</span>
                </div>
              ) : (
                rangos.map((rango) => {
                  const edit = editState[rango.id];
                  if (!edit) return null;
                  const isSaving = saving === rango.id;
                  const justSaved = savedId === rango.id;
                  const hasChanges =
                    edit.NOMBRE !== rango.NOMBRE ||
                    edit.colorHex !== bgrToHex(rango.COLOR) ||
                    edit.textoHex !== bgrToHex(rango.COLORTEXTO);

                  return (
                    <motion.div
                      key={rango.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: rangos.indexOf(rango) * 0.06 }}
                      className="rounded-2xl border border-slate-800/80 bg-slate-900/50 overflow-hidden"
                    >
                      {/* Card header */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/30 border-b border-slate-800/50">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          ΔE ≤ {formatValor(rango.VALOR)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {justSaved && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="flex items-center gap-1 text-green-400"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Guardado</span>
                            </motion.div>
                          )}
                          {hasChanges && !justSaved && (
                            <button
                              onClick={() => handleSave(rango.id)}
                              disabled={isSaving}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#a38105] hover:bg-[#b8920a] disabled:opacity-50 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95"
                            >
                              {isSaving ? (
                                <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                              Guardar
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="p-4 space-y-3">
                        {/* Nombre */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                            Nombre
                          </label>
                          <input
                            type="text"
                            value={edit.NOMBRE}
                            onChange={e => updateEdit(rango.id, 'NOMBRE', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#a38105]/50 focus:ring-1 focus:ring-[#a38105]/20 transition-all"
                            placeholder="Nombre del rango"
                          />
                        </div>

                        {/* Color pickers row */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Background color */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                              <Palette className="h-3 w-3" />
                              Fondo
                            </label>
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <input
                                  type="color"
                                  value={edit.colorHex}
                                  onChange={e => updateEdit(rango.id, 'colorHex', e.target.value)}
                                  className="w-10 h-10 rounded-xl cursor-pointer border-2 border-slate-700/50 hover:border-[#a38105]/50 transition-colors bg-transparent [&::-webkit-color-swatch-wrapper]{padding:0} [&::-webkit-color-swatch]{border:none;border-radius:8px}"
                                  style={{ padding: 0 }}
                                />
                              </div>
                              <span className="text-[11px] font-mono text-slate-400 uppercase">{edit.colorHex}</span>
                            </div>
                          </div>

                          {/* Text color */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                              <Type className="h-3 w-3" />
                              Texto
                            </label>
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <input
                                  type="color"
                                  value={edit.textoHex}
                                  onChange={e => updateEdit(rango.id, 'textoHex', e.target.value)}
                                  className="w-10 h-10 rounded-xl cursor-pointer border-2 border-slate-700/50 hover:border-[#a38105]/50 transition-colors bg-transparent [&::-webkit-color-swatch-wrapper]{padding:0} [&::-webkit-color-swatch]{border:none;border-radius:8px}"
                                  style={{ padding: 0 }}
                                />
                              </div>
                              <span className="text-[11px] font-mono text-slate-400 uppercase">{edit.textoHex}</span>
                            </div>
                          </div>
                        </div>

                        {/* Live preview */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                            Vista previa
                          </label>
                          <div
                            className="relative rounded-xl px-4 py-3 text-center font-bold text-sm shadow-lg transition-all duration-300 overflow-hidden"
                            style={{
                              backgroundColor: edit.colorHex,
                              color: edit.textoHex,
                            }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                            <span className="relative z-10">
                              ΔE {rango.VALOR < 999 ? rango.VALOR.toFixed(2) : '—'} — {edit.NOMBRE}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 space-y-3">
              <button
                onClick={handleReset}
                disabled={resetting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {resetting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Restaurar valores por defecto
              </button>
              <p className="text-[10px] text-slate-600 text-center uppercase tracking-widest">
                Estos rangos definen los colores de los resultados ΔE
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
