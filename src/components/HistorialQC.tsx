import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { X, Calendar, Layers, FileText, ChevronRight, Hash, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

export interface QCRecord {
  id: number;
  nombre: string | null;
  descripcion: string | null;
  patron_nombre: string | null;
  patron_l: number | null;
  patron_a: number | null;
  patron_b: number | null;
  patron_hex: string | null;
  muestra_nombre: string | null;
  muestra_l: number | null;
  muestra_a: number | null;
  muestra_b: number | null;
  muestra_hex: string | null;
  delta_e: number | null;
  delta_l: number | null;
  delta_a: number | null;
  delta_b: number | null;
  blanco_referencia: string | null;
  modo_medicion: string | null;
  densidad: string | null;
  pdf_url: string | null;
  creado_en: string;
  IDFORMULA?: string | null;
  LOTE?: string | null;
}

interface HistorialQCProps {
  isOpen: boolean;
  onClose: () => void;
  idFormula?: string | null;
  lote?: string | null;
  formulaName?: string | null;
  onSelectRecord?: (record: QCRecord) => void;
}

function labToHex(L: number, a: number, b: number): string {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
  const cube = (v: number) => v * v * v;
  const X = Xn * (cube(fx) > 0.008856 ? cube(fx) : (fx - 16 / 116) / 7.787);
  const Y = Yn * (cube(fy) > 0.008856 ? cube(fy) : (fy - 16 / 116) / 7.787);
  const Z = Zn * (cube(fz) > 0.008856 ? cube(fz) : (fz - 16 / 116) / 7.787);
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let bl = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const toHex = (v: number) => Math.round(clamp(gamma(v)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(d.getTime() + offsetMs);
  return localDate.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export default function HistorialQC({
  isOpen,
  onClose,
  idFormula,
  lote,
  formulaName,
  onSelectRecord,
}: HistorialQCProps) {
  const [registros, setRegistros] = useState<QCRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<QCRecord | null>(null);

  const fetchHistorial = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const userDataStr = localStorage.getItem('userData');
      const userDataObj = userDataStr ? JSON.parse(userDataStr) : null;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userDataObj?.idcliente) headers['x-client-id'] = userDataObj.idcliente.toString();

      const params = new URLSearchParams();
      params.set('limit', '100');
      if (idFormula) params.set('idformula', String(idFormula));
      if (lote) params.set('lote', String(lote));

      const res = await fetch(`${API_BASE_URL}/api/qualitycontrol?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const records: QCRecord[] = data.records || [];
        // Orden descendente por fecha (más recientes primero)
        records.sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime());
        setRegistros(records);
        if (records.length > 0) {
          setSelectedRecord(records[0]);
        } else {
          setSelectedRecord(null);
        }
      }
    } catch (err) {
      console.error('Error fetching QC history:', err);
    } finally {
      setLoading(false);
    }
  }, [idFormula, lote]);

  useEffect(() => {
    if (isOpen) {
      fetchHistorial();
    }
  }, [isOpen, fetchHistorial]);

  if (!isOpen) return null;

  const getPatronHexVal = (rec: QCRecord) => {
    if (rec.patron_hex) return rec.patron_hex;
    if (rec.patron_l != null && rec.patron_a != null && rec.patron_b != null) {
      return labToHex(rec.patron_l, rec.patron_a, rec.patron_b);
    }
    return '#334155';
  };

  const getMuestraHexVal = (rec: QCRecord) => {
    if (rec.muestra_hex) return rec.muestra_hex;
    if (rec.muestra_l != null && rec.muestra_a != null && rec.muestra_b != null) {
      return labToHex(rec.muestra_l, rec.muestra_a, rec.muestra_b);
    }
    return '#334155';
  };

  return (
    <div className="fixed inset-0 z-[70000] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="w-full max-w-5xl h-[92vh] max-h-[850px] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-premium)'
        }}
      >
        {/* Header con el color de acento del Dashboard (#CC5200 / var(--accent-orange)) */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0 shadow-md"
          style={{
            backgroundColor: 'var(--accent-orange, #CC5200)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-black/15 rounded-xl flex items-center justify-center border border-white/20 text-white shadow-inner">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-tight leading-none">
                  Historial de Control de Calidad
                </h2>
                <span className="text-[10px] bg-black/20 text-white border border-white/20 px-2 py-0.5 rounded-full font-mono font-bold">
                  {registros.length}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-white/80 mt-1 flex-wrap">
                {formulaName && <span className="font-semibold text-white truncate max-w-[220px]">{formulaName}</span>}
                {idFormula && (
                  <span className="flex items-center gap-1 font-mono text-[11px] text-white/90">
                    <Hash className="h-3 w-3 text-white/70" />
                    ID: {idFormula}
                  </span>
                )}
                {lote && (
                  <span className="flex items-center gap-1 font-mono text-[11px] text-white font-bold bg-black/15 px-2 py-0.5 rounded-md border border-white/10">
                    Lote: {lote}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-black/15 rounded-xl transition-all active:scale-95"
            title="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Layout */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          {/* Left: Lista de controles */}
          <div
            className="md:col-span-5 flex flex-col min-h-0"
            style={{
              backgroundColor: 'var(--bg-app)',
              borderRight: '1px solid var(--border-card)'
            }}
          >
            <div
              className="px-4 py-2.5 flex items-center justify-between text-xs flex-shrink-0"
              style={{
                borderBottom: '1px solid var(--border-card)',
                backgroundColor: 'var(--bg-card)'
              }}
            >
              <span className="font-bold uppercase tracking-wider text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Registros ordenados por fecha
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Más recientes primero</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div
                    className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                    style={{ borderColor: 'var(--accent-orange)', borderTopColor: 'transparent' }}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Cargando historial...
                  </span>
                </div>
              ) : registros.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed m-2"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-card)'
                  }}
                >
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center mb-3 shadow-inner"
                    style={{
                      backgroundColor: 'var(--bg-ingredient-icon, rgba(184, 93, 0, 0.1))',
                      border: '1px solid var(--border-card)'
                    }}
                  >
                    <Layers className="h-7 w-7" style={{ color: 'var(--accent-orange)' }} />
                  </div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Sin controles registrados</p>
                  <p className="text-xs mt-1 max-w-[260px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    No se encontraron registros de calidad guardados para esta fórmula y lote.
                  </p>
                </div>
              ) : (
                registros.map((rec) => {
                  const isSelected = selectedRecord?.id === rec.id;
                  const pCol = getPatronHexVal(rec);
                  const mCol = getMuestraHexVal(rec);

                  return (
                    <motion.div
                      key={rec.id}
                      whileHover={{ y: -1, scale: 1.005 }}
                      whileTap={{ scale: 0.995 }}
                      onClick={() => setSelectedRecord(rec)}
                      className="p-3.5 rounded-2xl transition-all cursor-pointer group"
                      style={{
                        backgroundColor: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                        border: isSelected ? '1px solid var(--accent-orange)' : '1px solid var(--border-card)',
                        boxShadow: isSelected ? '0 4px 14px -3px rgba(184, 93, 0, 0.25)' : 'none'
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <h4
                            className="text-xs font-bold truncate transition-colors uppercase tracking-tight"
                            style={{ color: isSelected ? 'var(--accent-orange)' : 'var(--text-primary)' }}
                          >
                            {rec.nombre || 'Control sin nombre'}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                            <Calendar className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                            <span>{formatDate(rec.creado_en)}</span>
                          </div>
                        </div>

                        {rec.delta_e != null && (
                          <div
                            className="px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold whitespace-nowrap shadow-sm"
                            style={{
                              backgroundColor: rec.delta_e <= 1.0
                                ? 'rgba(16, 185, 129, 0.12)'
                                : rec.delta_e <= 2.0
                                ? 'rgba(245, 158, 11, 0.12)'
                                : 'rgba(239, 68, 68, 0.12)',
                              borderColor: rec.delta_e <= 1.0
                                ? 'rgba(16, 185, 129, 0.35)'
                                : rec.delta_e <= 2.0
                                ? 'rgba(245, 158, 11, 0.35)'
                                : 'rgba(239, 68, 68, 0.35)',
                              color: rec.delta_e <= 1.0
                                ? '#10b981'
                                : rec.delta_e <= 2.0
                                ? '#f59e0b'
                                : '#ef4444'
                            }}
                          >
                            ΔE {rec.delta_e.toFixed(2)}
                          </div>
                        )}
                      </div>

                      <div
                        className="flex items-center justify-between gap-3 pt-2.5 mt-2"
                        style={{ borderTop: '1px solid var(--border-card)' }}
                      >
                        {/* Swatches Patrón vs Muestra */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-4 w-4 rounded-md border shadow-inner"
                              style={{ backgroundColor: pCol, borderColor: 'rgba(255,255,255,0.25)' }}
                              title="Patrón"
                            />
                            <span className="text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>
                              Patrón
                            </span>
                          </div>
                          <span style={{ color: 'var(--text-muted)' }} className="text-xs">/</span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-4 w-4 rounded-md border shadow-inner"
                              style={{ backgroundColor: mCol, borderColor: 'rgba(255,255,255,0.25)' }}
                              title="Muestra"
                            />
                            <span className="text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>
                              Muestra
                            </span>
                          </div>
                        </div>

                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            isSelected ? 'translate-x-0.5' : ''
                          }`}
                          style={{ color: isSelected ? 'var(--accent-orange)' : 'var(--text-muted)' }}
                        />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Detalle del registro seleccionado */}
          <div
            className="md:col-span-7 flex flex-col min-h-0"
            style={{ backgroundColor: 'var(--bg-card)' }}
          >
            {selectedRecord ? (
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar">
                {/* Header detalle */}
                <div
                  className="flex items-start justify-between gap-4 pb-4"
                  style={{ borderBottom: '1px solid var(--border-card)' }}
                >
                  <div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider block mb-1"
                      style={{ color: 'var(--accent-orange)' }}
                    >
                      Detalle de Control
                    </span>
                    <h3 className="text-lg font-bold uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      {selectedRecord.nombre || 'Control de Calidad'}
                    </h3>
                    <p className="text-xs mt-1 flex items-center gap-2 font-medium" style={{ color: 'var(--text-muted)' }}>
                      <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                      {formatDate(selectedRecord.creado_en)}
                    </p>
                  </div>

                  {selectedRecord.delta_e != null && (
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Delta E (CIEDE2000)
                      </div>
                      <div
                        className="text-2xl font-black font-mono mt-0.5"
                        style={{
                          color: selectedRecord.delta_e <= 1.0
                            ? '#10b981'
                            : selectedRecord.delta_e <= 2.0
                            ? '#f59e0b'
                            : '#ef4444'
                        }}
                      >
                        {selectedRecord.delta_e.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Descripción / Notas */}
                {selectedRecord.descripcion && (
                  <div
                    className="p-4 rounded-2xl"
                    style={{
                      backgroundColor: 'var(--bg-card-hover)',
                      border: '1px solid var(--border-card)'
                    }}
                  >
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest block mb-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Descripción / Notas
                    </span>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {selectedRecord.descripcion}
                    </p>
                  </div>
                )}

                {/* Comparación Visual Swatches */}
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="rounded-2xl p-4 flex flex-col items-center"
                    style={{
                      backgroundColor: 'var(--bg-card-hover)',
                      border: '1px solid var(--border-card)'
                    }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                      Patrón
                    </span>
                    <div
                      className="w-full h-16 rounded-xl border shadow-inner flex items-center justify-center"
                      style={{
                        backgroundColor: getPatronHexVal(selectedRecord),
                        borderColor: 'rgba(255,255,255,0.25)'
                      }}
                    />
                    <span
                      className="text-xs font-mono font-bold mt-2 truncate max-w-full uppercase"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {selectedRecord.patron_nombre || 'Patrón'}
                    </span>
                    <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--text-muted)' }}>
                      {getPatronHexVal(selectedRecord)}
                    </span>
                  </div>

                  <div
                    className="rounded-2xl p-4 flex flex-col items-center"
                    style={{
                      backgroundColor: 'var(--bg-card-hover)',
                      border: '1px solid var(--border-card)'
                    }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                      Muestra
                    </span>
                    <div
                      className="w-full h-16 rounded-xl border shadow-inner flex items-center justify-center"
                      style={{
                        backgroundColor: getMuestraHexVal(selectedRecord),
                        borderColor: 'rgba(255,255,255,0.25)'
                      }}
                    />
                    <span
                      className="text-xs font-mono font-bold mt-2 truncate max-w-full uppercase"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {selectedRecord.muestra_nombre || 'Muestra'}
                    </span>
                    <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--text-muted)' }}>
                      {getMuestraHexVal(selectedRecord)}
                    </span>
                  </div>
                </div>

                {/* Tabla de valores LAB */}
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-card)'
                  }}
                >
                  <div
                    className="px-4 py-2.5 flex items-center justify-between"
                    style={{
                      backgroundColor: 'var(--bg-table-header, var(--bg-card))',
                      borderBottom: '1px solid var(--border-card)'
                    }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Comparativa CIELAB (D65/10°)
                    </span>
                  </div>
                  <div
                    className="divide-y font-mono text-xs"
                    style={{ borderColor: 'var(--border-card)' }}
                  >
                    <div
                      className="grid grid-cols-4 px-4 py-2 text-[10px] uppercase font-bold"
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.06)',
                        color: 'var(--text-muted)'
                      }}
                    >
                      <span>Canal</span>
                      <span className="text-center">Patrón</span>
                      <span className="text-center">Muestra</span>
                      <span className="text-right">Diferencia</span>
                    </div>

                    {/* Canal L */}
                    <div className="grid grid-cols-4 px-4 py-2.5 items-center" style={{ borderTop: '1px solid var(--border-card)' }}>
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>L* (Luminosidad)</span>
                      <span className="text-center" style={{ color: 'var(--text-secondary)' }}>
                        {selectedRecord.patron_l != null ? selectedRecord.patron_l.toFixed(2) : '—'}
                      </span>
                      <span className="text-center" style={{ color: 'var(--text-secondary)' }}>
                        {selectedRecord.muestra_l != null ? selectedRecord.muestra_l.toFixed(2) : '—'}
                      </span>
                      <span
                        className="text-right font-bold"
                        style={{
                          color: (selectedRecord.delta_l ?? 0) >= 0 ? '#10b981' : '#3b82f6'
                        }}
                      >
                        {selectedRecord.delta_l != null
                          ? (selectedRecord.delta_l >= 0 ? '+' : '') + selectedRecord.delta_l.toFixed(2)
                          : selectedRecord.muestra_l != null && selectedRecord.patron_l != null
                          ? ((selectedRecord.muestra_l - selectedRecord.patron_l >= 0 ? '+' : '') +
                              (selectedRecord.muestra_l - selectedRecord.patron_l).toFixed(2))
                          : '—'}
                      </span>
                    </div>

                    {/* Canal A */}
                    <div className="grid grid-cols-4 px-4 py-2.5 items-center" style={{ borderTop: '1px solid var(--border-card)' }}>
                      <span className="font-bold" style={{ color: 'var(--accent-orange)' }}>a* (Rojo / Verde)</span>
                      <span className="text-center" style={{ color: 'var(--text-secondary)' }}>
                        {selectedRecord.patron_a != null ? selectedRecord.patron_a.toFixed(2) : '—'}
                      </span>
                      <span className="text-center" style={{ color: 'var(--text-secondary)' }}>
                        {selectedRecord.muestra_a != null ? selectedRecord.muestra_a.toFixed(2) : '—'}
                      </span>
                      <span
                        className="text-right font-bold"
                        style={{
                          color: (selectedRecord.delta_a ?? 0) >= 0 ? '#ef4444' : '#10b981'
                        }}
                      >
                        {selectedRecord.delta_a != null
                          ? (selectedRecord.delta_a >= 0 ? '+' : '') + selectedRecord.delta_a.toFixed(2)
                          : selectedRecord.muestra_a != null && selectedRecord.patron_a != null
                          ? ((selectedRecord.muestra_a - selectedRecord.patron_a >= 0 ? '+' : '') +
                              (selectedRecord.muestra_a - selectedRecord.patron_a).toFixed(2))
                          : '—'}
                      </span>
                    </div>

                    {/* Canal B */}
                    <div className="grid grid-cols-4 px-4 py-2.5 items-center" style={{ borderTop: '1px solid var(--border-card)' }}>
                      <span className="font-bold" style={{ color: '#005ec3' }}>b* (Amarillo / Azul)</span>
                      <span className="text-center" style={{ color: 'var(--text-secondary)' }}>
                        {selectedRecord.patron_b != null ? selectedRecord.patron_b.toFixed(2) : '—'}
                      </span>
                      <span className="text-center" style={{ color: 'var(--text-secondary)' }}>
                        {selectedRecord.muestra_b != null ? selectedRecord.muestra_b.toFixed(2) : '—'}
                      </span>
                      <span
                        className="text-right font-bold"
                        style={{
                          color: (selectedRecord.delta_b ?? 0) >= 0 ? '#f59e0b' : '#3b82f6'
                        }}
                      >
                        {selectedRecord.delta_b != null
                          ? (selectedRecord.delta_b >= 0 ? '+' : '') + selectedRecord.delta_b.toFixed(2)
                          : selectedRecord.muestra_b != null && selectedRecord.patron_b != null
                          ? ((selectedRecord.muestra_b - selectedRecord.patron_b >= 0 ? '+' : '') +
                              (selectedRecord.muestra_b - selectedRecord.patron_b).toFixed(2))
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metadatos técnicos */}
                {(selectedRecord.blanco_referencia || selectedRecord.modo_medicion || selectedRecord.densidad) && (
                  <div
                    className="flex flex-wrap gap-2 text-[10px] p-3 rounded-xl"
                    style={{
                      backgroundColor: 'var(--bg-card-hover)',
                      border: '1px solid var(--border-card)',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {selectedRecord.blanco_referencia && (
                      <span
                        className="px-2.5 py-1 rounded-md border font-medium"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          borderColor: 'var(--border-card)',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        Blanco: {selectedRecord.blanco_referencia}
                      </span>
                    )}
                    {selectedRecord.modo_medicion && (
                      <span
                        className="px-2.5 py-1 rounded-md border font-medium"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          borderColor: 'var(--border-card)',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        Modo: {selectedRecord.modo_medicion}
                      </span>
                    )}
                    {selectedRecord.densidad && (
                      <span
                        className="px-2.5 py-1 rounded-md border font-medium"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          borderColor: 'var(--border-card)',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        Densidad: {selectedRecord.densidad}
                      </span>
                    )}
                  </div>
                )}

                {/* Acciones del detalle */}
                <div className="flex items-center gap-3 pt-2">
                  {onSelectRecord && (
                    <button
                      onClick={() => {
                        onSelectRecord(selectedRecord);
                        onClose();
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg"
                      style={{
                        backgroundColor: 'var(--accent-orange, #CC5200)',
                        boxShadow: '0 6px 20px -4px rgba(184, 93, 0, 0.35)'
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 text-white" />
                      Cargar en pantalla de QC
                    </button>
                  )}

                  {selectedRecord.pdf_url && (
                    <a
                      href={`${API_BASE_URL}${selectedRecord.pdf_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 border"
                      style={{
                        backgroundColor: 'var(--bg-card-hover)',
                        borderColor: 'var(--border-card)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <FileText className="h-4 w-4" style={{ color: 'var(--accent-orange)' }} />
                      Ver PDF
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <ArrowLeft className="h-10 w-10 mb-3 animate-pulse" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-bold uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Selecciona un registro
                </p>
                <p className="text-xs mt-1 max-w-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Elige un control de calidad de la lista izquierda para ver su comparativa técnica completa.
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
