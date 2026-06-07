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

interface EditRow {
  NOMBRE: string;
  VALOR: string;
  colorHex: string;
  textoHex: string;
}

type PickerTarget = { id: number; field: 'colorHex' | 'textoHex' };

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

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return { h: Math.round(h), s: Math.round(s), v: Math.round(v) };
}

function hsvToHex(h: number, s: number, v: number): string {
  const sf = s / 100;
  const vf = v / 100;
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return vf - vf * sf * Math.max(Math.min(k, 4 - k, 1), 0);
  };
  const r = Math.round(Math.max(0, Math.min(255, f(5) * 255)));
  const g = Math.round(Math.max(0, Math.min(255, f(3) * 255)));
  const b = Math.round(Math.max(0, Math.min(255, f(1) * 255)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export default function DeltaRango({ isOpen, onClose }: DeltaRangoProps) {
  const [rangos, setRangos] = useState<RangoRow[]>([]);
  const [editState, setEditState] = useState<Record<number, EditRow>>({});
  const [loading, setLoading] = useState(false);
  const [globalSaving, setGlobalSaving] = useState(false);
  const [globalSaved, setGlobalSaved] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState<PickerTarget | null>(null);

  const getHeaders = () => {
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
      } catch { }
    }
    return headers;
  };

  const fetchRangos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/deltarango`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Error al cargar rangos');
      const data: RangoRow[] = await res.json();
      setRangos(data);
      const state: Record<number, EditRow> = {};
      data.forEach(r => {
        state[r.id] = {
          NOMBRE: r.NOMBRE,
          VALOR: r.VALOR.toString(),
          colorHex: bgrToHex(r.COLOR),
          textoHex: bgrToHex(r.COLORTEXTO),
        };
      });
      setEditState(state);
      setGlobalSaved(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchRangos();
      setShowConfirm(false);
      setGlobalSaved(false);
      setActiveColorPicker(null);
    }
  }, [isOpen]);

  const getValidationError = (id: number, valorStr: string): string | null => {
    const valor = parseFloat(valorStr);
    if (valorStr === '' || isNaN(valor)) return 'Ingrese un número válido';
    if (valor < 0) return 'No puede ser negativo';
    const currentIndex = rangos.findIndex(r => r.id === id);
    if (currentIndex === -1) return null;
    if (currentIndex > 0) {
      const prevValor = rangos[currentIndex - 1].VALOR;
      if (valor <= prevValor) return `Debe ser > ${formatValor(prevValor)}`;
    }
    if (currentIndex < rangos.length - 1) {
      const nextValor = rangos[currentIndex + 1].VALOR;
      if (nextValor < 999999 && valor >= nextValor) {
        return `Debe ser < ${formatValor(nextValor)}`;
      }
    }
    return null;
  };

  const updateEdit = (id: number, field: string, value: string) => {
    setEditState(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
    setGlobalSaved(false);
  };

  const hasUnsavedChanges = rangos.some(rango => {
    const edit = editState[rango.id];
    if (!edit) return false;
    return (
      edit.NOMBRE !== rango.NOMBRE ||
      edit.VALOR !== rango.VALOR.toString() ||
      edit.colorHex !== bgrToHex(rango.COLOR) ||
      edit.textoHex !== bgrToHex(rango.COLORTEXTO)
    );
  });

  const hasValidationErrors = rangos.some(rango => {
    const edit = editState[rango.id];
    if (!edit) return false;
    return getValidationError(rango.id, edit.VALOR) !== null;
  });

  const handleSaveAll = async () => {
    setGlobalSaving(true);
    setError(null);
    try {
      const changedRows = rangos.filter(rango => {
        const edit = editState[rango.id];
        if (!edit) return false;
        return (
          edit.NOMBRE !== rango.NOMBRE ||
          edit.VALOR !== rango.VALOR.toString() ||
          edit.colorHex !== bgrToHex(rango.COLOR) ||
          edit.textoHex !== bgrToHex(rango.COLORTEXTO)
        );
      });

      await Promise.all(changedRows.map(rango => {
        const edit = editState[rango.id];
        return fetch(`${API_BASE_URL}/api/deltarango/${rango.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            NOMBRE: edit.NOMBRE,
            VALOR: parseFloat(edit.VALOR),
            COLOR: hexToBgr(edit.colorHex),
            COLORTEXTO: hexToBgr(edit.textoHex),
          }),
        });
      }));

      await fetchRangos();
      setGlobalSaved(true);
      setTimeout(() => setGlobalSaved(false), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGlobalSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/deltarango/reset`, { method: 'POST', headers: getHeaders() });
      if (!res.ok) throw new Error('Error al restaurar');
      const data: RangoRow[] = await res.json();
      setRangos(data);
      const state: Record<number, EditRow> = {};
      data.forEach(r => {
        state[r.id] = {
          NOMBRE: r.NOMBRE,
          VALOR: r.VALOR.toString(),
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

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowConfirm(true);
    } else {
      onClose();
    }
  };

  const handleBackdropClick = () => {
    if (hasUnsavedChanges) {
      setShowConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmSaveAndExit = async () => {
    setShowConfirm(false);
    await handleSaveAll();
    onClose();
  };

  const handleConfirmDiscard = () => {
    setShowConfirm(false);
    onClose();
  };

  const pickerHex = activeColorPicker
    ? editState[activeColorPicker.id]?.[activeColorPicker.field] ?? null
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdropClick}
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
            <div className="flex items-center justify-between px-6 py-5 bg-[#a38105] shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Palette className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-xs font-bold text-white uppercase tracking-widest">Rangos de Delta</h2>
              </div>
              <button onClick={handleClose} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-4 px-4 space-y-3">
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

              {globalSaved && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-xs"
                >
                  <Check className="h-4 w-4 flex-shrink-0" />
                  <span>Cambios guardados correctamente</span>
                </motion.div>
              )}

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#a38105] border-t-transparent" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">Cargando rangos…</span>
                </div>
              ) : (
                rangos.map((rango, index) => {
                  const edit = editState[rango.id];
                  if (!edit) return null;
                  const infinite = rango.VALOR >= 999999;
                  const validationError = getValidationError(rango.id, edit.VALOR);

                  return (
                    <motion.div
                      key={rango.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06 }}
                      className="rounded-2xl border border-slate-800/80 bg-slate-900/50 overflow-hidden"
                    >
                      {/* Card header */}
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-[#a38105]/15 to-[#a38105]/5  border-b border-slate-800/50">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          Valor ΔE ≤
                        </span>
                        {infinite ? (
                          <span className="text-sm font-bold text-slate-300">∞</span>
                        ) : (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={edit.VALOR}
                            onChange={e => updateEdit(rango.id, 'VALOR', e.target.value)}
                            className={`w-16 px-2 py-1 bg-slate-800/60 border rounded-lg text-sm font-bold text-slate-200 text-center focus:outline-none focus:ring-1 transition-all ${validationError
                                ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                                : 'border-slate-700/50 focus:border-[#a38105]/50 focus:ring-[#a38105]/20'
                              }`}
                          />
                        )}
                      </div>

                      {/* Card body */}
                      <div className="p-4 space-y-3">
                        {validationError && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="flex items-center gap-1.5 text-red-400 text-[10px] bg-gradient-to-br from-[#a38105]/15 to-[#a38105]/5  font-bold uppercase tracking-widest"
                          >
                            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                            <span>{validationError}</span>
                          </motion.div>
                        )}

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
                          {([['Fondo', 'colorHex', Palette], ['Texto', 'textoHex', Type]] as const).map(([label, field, Icon]) => (
                            <div key={field}>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                                <Icon className="h-3 w-3" />
                                {label}
                              </label>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setActiveColorPicker(
                                    activeColorPicker?.id === rango.id && activeColorPicker?.field === field
                                      ? null
                                      : { id: rango.id, field }
                                  )}
                                  className="w-10 h-10 rounded-xl border-2 border-slate-700/50 hover:border-[#a38105]/50 transition-all cursor-pointer flex-shrink-0 overflow-hidden"
                                  style={{ backgroundColor: edit[field] }}
                                >
                                  <div className="w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                                </button>
                                <span className="text-[11px] font-mono text-slate-400 uppercase">{edit[field]}</span>
                              </div>
                            </div>
                          ))}
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
                onClick={handleSaveAll}
                disabled={globalSaving || !hasUnsavedChanges || hasValidationErrors}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#a38105] hover:bg-[#b8920a] disabled:opacity-40 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-[#a38105]/20"
              >
                {globalSaving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {hasUnsavedChanges
                  ? `Guardar cambios (${rangos.filter(r => {
                    const e = editState[r.id];
                    return e && (
                      e.NOMBRE !== r.NOMBRE ||
                      e.VALOR !== r.VALOR.toString() ||
                      e.colorHex !== bgrToHex(r.COLOR) ||
                      e.textoHex !== bgrToHex(r.COLORTEXTO)
                    );
                  }).length})`
                  : 'Guardar cambios'}
              </button>

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

              {hasUnsavedChanges && (
                <p className="text-[10px] text-[#a38105] text-center uppercase tracking-widest font-bold">
                  * Tiene cambios sin guardar
                </p>
              )}
            </div>
          </motion.div>

          {/* HSV Color Picker Modal */}
          <AnimatePresence>
            {activeColorPicker && pickerHex && (
              <HsvModal
                hex={pickerHex}
                onChange={v => {
                  const { id, field } = activeColorPicker;
                  updateEdit(id, field, v);
                }}
                onClose={() => setActiveColorPicker(null)}
              />
            )}
          </AnimatePresence>

          {/* Confirmation dialog */}
          <AnimatePresence>
            {showConfirm && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <AlertTriangle className="w-24 h-24 text-[#a38105]" />
                  </div>
                  <div className="relative">
                    <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Cambios sin guardar</h3>
                    <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                      Tiene cambios sin guardar en los rangos de delta. ¿Desea guardar antes de salir?
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleConfirmSaveAndExit}
                        disabled={globalSaving || hasValidationErrors}
                        className="w-full px-6 py-3 rounded-xl bg-[#a38105] hover:bg-[#b8920a] disabled:opacity-40 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-[#a38105]/20"
                      >
                        {globalSaving ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Guardando…
                          </span>
                        ) : (
                          'Guardar y salir'
                        )}
                      </button>
                      <button
                        onClick={handleConfirmDiscard}
                        disabled={globalSaving}
                        className="w-full px-6 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40"
                      >
                        Salir sin guardar
                      </button>
                      <button
                        onClick={() => setShowConfirm(false)}
                        disabled={globalSaving}
                        className="w-full px-6 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}

function HsvModal({ hex, onChange, onClose }: { hex: string; onChange: (h: string) => void; onClose: () => void }) {
  const initial = hexToHsv(hex);
  const [h, setH] = useState(initial.h);
  const [s, setS] = useState(initial.s);
  const [v, setV] = useState(initial.v);
  const [hexInput, setHexInput] = useState(hex);

  const commit = (nh: number, ns: number, nv: number) => {
    const newHex = hsvToHex(nh, ns, nv);
    setHexInput(newHex);
    onChange(newHex);
  };

  const handleH = (val: number) => { setH(val); commit(val, s, v); };
  const handleS = (val: number) => { setS(val); commit(h, val, v); };
  const handleV = (val: number) => { setV(val); commit(h, s, val); };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-xs bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-6 opacity-5">
          <Palette className="w-20 h-20 text-[#a38105]" />
        </div>

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg border border-slate-600/50 flex-shrink-0" style={{ backgroundColor: hsvToHex(h, s, v) }} />
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Selector de color</h3>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Hex input */}
            <div>
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Hex</label>
              <input
                type="text"
                value={hexInput}
                onChange={e => {
                  const val = e.target.value;
                  setHexInput(val);
                  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                    const hsv = hexToHsv(val);
                    setH(hsv.h); setS(hsv.s); setV(hsv.v);
                    onChange(val);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm font-mono text-slate-200 uppercase text-center tracking-wider focus:outline-none focus:border-[#a38105]/50 focus:ring-1 focus:ring-[#a38105]/20"
                placeholder="#000000"
              />
            </div>

            {/* Hue */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tono</span>
                <span className="text-[9px] font-mono text-slate-400">{h}°</span>
              </div>
              <input type="range" min={0} max={360} value={h} onChange={e => handleH(Number(e.target.value))} className="hsv-slider hsv-slider--hue w-full" />
            </div>

            {/* Saturation */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Saturación</span>
                <span className="text-[9px] font-mono text-slate-400">{s}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={s} onChange={e => handleS(Number(e.target.value))}
                className="hsv-slider w-full"
                style={{
                  background: `linear-gradient(to right, hsl(${h}, 0%, ${Math.round(50 - v * 0.25)}%), hsl(${h}, 100%, ${Math.round(50 - v * 0.25)}%))`,
                }}
              />
            </div>

            {/* Value */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Valor</span>
                <span className="text-[9px] font-mono text-slate-400">{v}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={v} onChange={e => handleV(Number(e.target.value))}
                className="hsv-slider w-full"
                style={{
                  background: `linear-gradient(to right, hsl(${h}, ${s}%, 0%), hsl(${h}, ${s}%, 100%))`,
                }}
              />
            </div>

            {/* Preview swatch */}
            <div className="pt-1">
              <div
                className="w-full h-10 rounded-xl border border-slate-700/50 transition-all duration-75"
                style={{ backgroundColor: hsvToHex(h, s, v) }}
              >
                <div className="w-full h-full bg-gradient-to-br from-white/10 to-transparent rounded-xl" />
              </div>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full mt-4 px-4 py-2.5 rounded-xl bg-[#a38105] hover:bg-[#b8920a] text-white text-[10px] font-bold uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-[#a38105]/20"
          >
            Listo
          </button>
        </div>
      </motion.div>
    </div>
  );
}
