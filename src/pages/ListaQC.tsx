import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Search,
  Calendar,
  X,
  Layers,
  FileText,
  ChevronRight,
  Loader2,
  AlertTriangle,
  SlidersHorizontal,
  Inbox,
} from 'lucide-react';
import { API_BASE_URL } from '../config';

// ─── Types ───────────────────────────────────────────────────────────────────

interface QCRecord {
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function labToHex(L: number, a: number, b: number): string {
  // Lab → XYZ (D65)
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
  const cube = (v: number) => v * v * v;
  const X = Xn * (cube(fx) > 0.008856 ? cube(fx) : (fx - 16 / 116) / 7.787);
  const Y = Yn * (cube(fy) > 0.008856 ? cube(fy) : (fy - 16 / 116) / 7.787);
  const Z = Zn * (cube(fz) > 0.008856 ? cube(fz) : (fz - 16 / 116) / 7.787);
  // XYZ → sRGB
  let r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let bl = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  const gamma = (v: number) => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const toHex = (v: number) => Math.round(clamp(gamma(v)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

function deltaEBadge(de: number | null) {
  const base = 'bg-[#a38105]/20 text-[#d4af37] border border-[#a38105]/30 shadow-sm';
  if (de === null) return { label: '—', color: `bg-slate-700 text-slate-400` };
  return { label: `ΔE ${de.toFixed(2)}`, color: base };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  // La fecha fue almacenada como hora local codificada como UTC (sin offset real).
  // Al parsear con new Date(), el browser la trata como UTC y resta el offset local.
  // Compensamos sumando el offset para recuperar la hora local original.
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(d.getTime() + offsetMs);
  return localDate.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function getPatronHex(rec: QCRecord): string {
  if (rec.patron_hex) return rec.patron_hex;
  if (rec.patron_l !== null && rec.patron_a !== null && rec.patron_b !== null) {
    return labToHex(rec.patron_l, rec.patron_a, rec.patron_b);
  }
  return '#374151';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ListaQC() {
  const navigate = useNavigate();

  const [records, setRecords]       = useState<QCRecord[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [isLoading, setIsLoading]   = useState(false);
  const [hasMore, setHasMore]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [search, setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [desde, setDesde]           = useState('');
  const [hasta, setHasta]           = useState('');
  const [activeFilters, setActiveFilters] = useState({ desde: '', hasta: '' });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);
  const LIMIT = 20;

  // ── Debounce search ──────────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 400);
  }, [search]);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (pageNum: number, currentSearch: string, currentFilters: { desde: string; hasta: string }) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const userDataStr = localStorage.getItem('userData');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;

      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userData?.idcliente) headers['x-client-id'] = userData.idcliente.toString();

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: LIMIT.toString(),
      });
      if (currentSearch) params.set('search', currentSearch);
      if (currentFilters.desde) params.set('desde', currentFilters.desde);
      if (currentFilters.hasta) params.set('hasta', currentFilters.hasta);

      const url = `${API_BASE_URL}/api/qualitycontrol?${params.toString()}`;

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

      const data = await res.json();

      let rows: QCRecord[] = [];
      let totalRecords = 0;

      if (Array.isArray(data)) {
        rows = data;
        totalRecords = data.length;
      } else if (data && Array.isArray(data.records)) {
        rows = data.records;
        totalRecords = data.total ?? data.records.length;
      }

      setTotal(totalRecords);
      setRecords(pageNum === 1 ? rows : (prev) => [...prev, ...rows]);
      setHasMore(rows.length === LIMIT);
    } catch (e: any) {
      setError(e.message || 'Error de conexión');
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // ── Reset + fetch page 1 when search or date filters change ─────────────
  useEffect(() => {
    setRecords([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    fetchPage(1, debouncedSearch, activeFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, activeFilters]);

  // ── Fetch next page when page changes (infinite scroll) ─────────────────
  useEffect(() => {
    if (page > 1) fetchPage(page, debouncedSearch, activeFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // ── Infinite scroll observer ──────────────────────────────────────────────
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isLoading) {
        setPage(prev => prev + 1);
      }
    }, { rootMargin: '200px' });
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, isLoading]);

  // ── Open QC with data ─────────────────────────────────────────────────────
  const openQCRecord = (rec: QCRecord) => {
    const ctx = {
      standard: rec.patron_l !== null
        ? { l: rec.patron_l, a: rec.patron_a, b: rec.patron_b, hex: getPatronHex(rec), name: rec.patron_nombre || 'Patrón' }
        : null,
      sample: rec.muestra_l !== null
        ? { l: rec.muestra_l, a: rec.muestra_a, b: rec.muestra_b, hex: rec.muestra_hex || '#374151', name: rec.muestra_nombre || 'Muestra' }
        : null,
      timestamp: rec.creado_en,
      sessionName: rec.nombre || '',
      sessionDesc: rec.descripcion || '',
      pdf_url: rec.pdf_url || null,
    };
    localStorage.setItem('qc_context', JSON.stringify(ctx));
    navigate('/quality-control');
  };

  const applyFilters = () => {
    setActiveFilters({ desde, hasta });
    setShowFilters(false);
  };

  const clearFilters = () => {
    setDesde('');
    setHasta('');
    setActiveFilters({ desde: '', hasta: '' });
    setShowFilters(false);
  };

  const hasActiveFilters = !!(activeFilters.desde || activeFilters.hasta);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0F14] text-slate-900 dark:text-slate-200 font-sans flex flex-col">

      {/* ── Header ── */}
      <header className="fixed top-0 z-20 flex w-full items-center gap-4 border-b border-black/20 bg-[#CC5200] shadow-xl px-4 py-3.5">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-xl bg-black/15 hover:bg-black/30 transition-colors active:scale-95"
          title="Volver al Dashboard"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-white uppercase tracking-wide leading-none truncate">
            Historial de Control de Calidad
          </h1>
          <p className="text-[11px] text-white/60 mt-0.5">
            {total > 0 ? `${total} registro${total !== 1 ? 's' : ''}` : 'Cargando…'}
          </p>
        </div>

        <button
          onClick={() => setShowFilters(v => !v)}
          className={`relative p-2 rounded-xl transition-colors active:scale-95 ${hasActiveFilters ? 'bg-white/20 text-white' : 'bg-black/15 hover:bg-black/30 text-white'}`}
          title="Filtrar por fecha"
        >
          <SlidersHorizontal className="h-5 w-5" />
          {hasActiveFilters && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full" />
          )}
        </button>
      </header>

      {/* ── Search bar ── */}
      <div className="fixed top-[60px] z-10 w-full bg-slate-50/95 dark:bg-[#0A0F14]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-4 py-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o descripción…"
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/60 rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#CC5200] focus:ring-2 focus:ring-[#CC5200]/20 transition-all shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Panel ── */}
      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowFilters(false)}
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="fixed top-[120px] left-4 right-4 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#CC5200]" /> Filtrar por fecha
                </h3>
                <button onClick={() => setShowFilters(false)}>
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[11px] text-slate-500 uppercase tracking-widest mb-1 block">Desde</label>
                  <input
                    type="date"
                    value={desde}
                    onChange={e => setDesde(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-[#CC5200]/60"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 uppercase tracking-widest mb-1 block">Hasta</label>
                  <input
                    type="date"
                    value={hasta}
                    onChange={e => setHasta(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-[#CC5200]/60"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={clearFilters}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  Limpiar
                </button>
                <button
                  onClick={applyFilters}
                  className="flex-1 py-2.5 rounded-xl bg-[#CC5200] hover:bg-[#CC5200]/80 text-white text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  Aplicar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main list ── */}
      <main className="pt-[120px] pb-10 flex-1 px-4">

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {activeFilters.desde && (
              <span className="flex items-center gap-1 text-[11px] bg-[#a38105]/20 text-[#d4af37] border border-[#a38105]/30 rounded-full px-3 py-1">
                <Calendar className="w-3 h-3" /> Desde: {activeFilters.desde}
                <button onClick={() => setActiveFilters(f => ({ ...f, desde: '' }))} className="ml-1 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {activeFilters.hasta && (
              <span className="flex items-center gap-1 text-[11px] bg-[#a38105]/20 text-[#d4af37] border border-[#a38105]/30 rounded-full px-3 py-1">
                <Calendar className="w-3 h-3" /> Hasta: {activeFilters.hasta}
                <button onClick={() => setActiveFilters(f => ({ ...f, hasta: '' }))} className="ml-1 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Error state */}
        {error && records.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-red-900/30 flex items-center justify-center border border-red-800/40">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <p className="text-slate-400 text-sm">{error}</p>
            <button
              onClick={() => { setError(null); setPage(1); }}
              className="text-xs text-[#CC5200] underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && records.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center gap-4"
          >
            <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-xl">
              <Inbox className="w-9 h-9 text-slate-400 dark:text-slate-600" />
            </div>
            <div>
              <p className="text-slate-700 dark:text-slate-300 font-semibold text-base">Sin registros</p>
              <p className="text-slate-500 dark:text-slate-500 text-sm mt-1 px-4">
                {debouncedSearch || hasActiveFilters
                  ? 'Ningún resultado coincide con los filtros aplicados.'
                  : 'Aún no hay controles de calidad guardados.'}
              </p>
            </div>
          </motion.div>
        )}

        {/* Records */}
        <div className="flex flex-col gap-4">
          <AnimatePresence initial={false}>
            {records.map((rec, idx) => {
              const hex = getPatronHex(rec);
              const badge = deltaEBadge(rec.delta_e);
              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx % LIMIT, 10) * 0.04 }}
                  className="group relative flex items-stretch bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200"
                >
                  {/* Color swatch */}
                  <div
                    className="w-16 flex-shrink-0 relative shadow-[inset_0_0_10px_rgba(0,0,0,0.1)]"
                    style={{ backgroundColor: hex }}
                    title={`Patrón: ${hex}`}
                  >
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-black/30 mix-blend-overlay" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4.5 min-w-0 py-4 px-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 truncate leading-snug">
                          {rec.nombre || 'Sin nombre'}
                        </h3>
                        {rec.descripcion && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1 leading-tight font-medium">
                            {rec.descripcion}
                          </p>
                        )}
                      </div>
                      <span className={`flex-shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-xl ${badge.color} shadow-sm`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Color chips row */}
                    <div className="flex items-center gap-2 mb-3 mt-1">
                      {/* Patron */}
                      <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700/50">
                        <div
                          className="w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/20 flex-shrink-0 shadow-inner"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">{hex.toUpperCase()}</span>
                      </div>
                      {rec.muestra_hex && (
                        <>
                          <ChevronRight className="w-3 h-3 text-slate-400 dark:text-slate-600" />
                          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700/50">
                            <div
                              className="w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/20 flex-shrink-0 shadow-inner"
                              style={{ backgroundColor: rec.muestra_hex }}
                            />
                            <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">{rec.muestra_hex.toUpperCase()}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Delta values */}
                    {(rec.delta_l !== null || rec.delta_a !== null || rec.delta_b !== null) && (
                      <div className="flex items-center gap-3 mb-2">
                        {rec.delta_l !== null && (
                          <span className="text-[10px] text-slate-600 font-mono">ΔL <span className="text-slate-400">{rec.delta_l.toFixed(2)}</span></span>
                        )}
                        {rec.delta_a !== null && (
                          <span className="text-[10px] text-slate-600 font-mono">Δa <span className="text-slate-400">{rec.delta_a.toFixed(2)}</span></span>
                        )}
                        {rec.delta_b !== null && (
                          <span className="text-[10px] text-slate-600 font-mono">Δb <span className="text-slate-400">{rec.delta_b.toFixed(2)}</span></span>
                        )}
                      </div>
                    )}

                    {/* Footer row */}
                    <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-500 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" /> {formatDate(rec.creado_en)}
                        </span>
                        {rec.pdf_url && (
                          <a
                            href={`${API_BASE_URL}${rec.pdf_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-[10px] text-[#a38105] hover:text-[#d4af37] flex items-center gap-1 transition-colors"
                          >
                            <FileText className="w-3 h-3" /> PDF
                          </a>
                        )}
                      </div>

                      {/* QC button */}
                      <button
                        onClick={() => openQCRecord(rec)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#CC5200]/15 hover:bg-[#CC5200]/30 border border-[#CC5200]/20 hover:border-[#CC5200]/50 text-[#CC5200] text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95"
                        title="Abrir en Control de Calidad"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        QC
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-4" />

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-center py-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
            >
              <Loader2 className="w-6 h-6 text-[#CC5200]" />
            </motion.div>
          </div>
        )}

        {/* End of list */}
        {!hasMore && records.length > 0 && (
          <p className="text-center text-[11px] text-slate-700 py-6 uppercase tracking-widest">
            — Fin del historial —
          </p>
        )}
      </main>
    </div>
  );
}
