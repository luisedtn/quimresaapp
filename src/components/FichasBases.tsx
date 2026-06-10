import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Search,
  X,
  ChevronDown,
  Upload,
  CheckCircle2,
  Trash2,
  Eye,
  Loader2,
  FileText,
  AlertTriangle,
  Inbox,
  ShieldCheck,
} from 'lucide-react';
import { API_BASE_URL } from '../config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Base {
  ID: number;
  GRUPO: string | null;
  CODIGO: string | null;
  DESCRIPCIO: string | null;
  PRODUCTO: string | null;
  FICHATECNICA: string | null;
  FICHASEGURIDAD: string | null;
}

interface FichasBasesProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── PDF Viewer ───────────────────────────────────────────────────────────────

function PDFViewer({ base64Data, title, onClose }: { base64Data: string; title: string; onClose: () => void }) {
  const src = base64Data.startsWith('data:') ? base64Data : `data:application/pdf;base64,${base64Data}`;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70000] flex flex-col bg-[#0A0F14]"
    >
      <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5 bg-[#0A0F14] border-b border-slate-800 shadow-lg">
        <div className="p-2 rounded-xl bg-[#CC5200]/15 border border-[#CC5200]/20">
          <FileText className="w-4 h-4 text-[#CC5200]" />
        </div>
        <span className="flex-1 text-sm font-bold text-white truncate">{title}</span>
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>
      </header>
      <div className="flex-1 overflow-hidden bg-slate-900">
        <iframe src={src} className="w-full h-full" title={title} />
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FichasBases({ isOpen, onClose }: FichasBasesProps) {
  const [bases, setBases] = useState<Base[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [grupos, setGrupos] = useState<string[]>([]);
  const [productos, setProductos] = useState<string[]>([]);
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [selectedProducto, setSelectedProducto] = useState('');
  const [showGrupoFilter, setShowGrupoFilter] = useState(false);
  const [showProductoFilter, setShowProductoFilter] = useState(false);

  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; field: 'FICHATECNICA' | 'FICHASEGURIDAD' } | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ data: string; title: string } | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    const userDataStr = localStorage.getItem('userData');
    const userData = userDataStr ? JSON.parse(userDataStr) : null;
    const headers: any = { Authorization: `Bearer ${token}` };
    if (userData?.idcliente) headers['x-client-id'] = userData.idcliente.toString();
    return headers;
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 400);
  }, [search]);

  const fetchBases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedGrupo) params.set('grupo', selectedGrupo);
      if (selectedProducto) params.set('producto', selectedProducto);

      const url = `${API_BASE_URL}/api/bases?${params.toString()}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      const data = await res.json();
      const rows: Base[] = Array.isArray(data) ? data : (data.records ?? []);
      setBases(rows);

      const gruposSet = new Set<string>();
      const productosSet = new Set<string>();
      rows.forEach((b) => {
        if (b.GRUPO) gruposSet.add(b.GRUPO);
        if (b.PRODUCTO) productosSet.add(b.PRODUCTO);
      });
      setGrupos(Array.from(gruposSet).sort());
      setProductos(Array.from(productosSet).sort());
    } catch (e: any) {
      setError(e.message || 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, selectedGrupo, selectedProducto, getHeaders]);

  useEffect(() => {
    if (isOpen) fetchBases();
  }, [isOpen, fetchBases]);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleUpload = async (id: number, field: 'FICHATECNICA' | 'FICHASEGURIDAD', file: File) => {
    const key = `${id}-${field}`;
    setUploading((prev) => ({ ...prev, [key]: true }));
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch(`${API_BASE_URL}/api/bases/${id}`, {
        method: 'PUT',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: base64 }),
      });
      if (!res.ok) throw new Error('No se pudo guardar el PDF');
      const updated = await res.json();
      setBases((prev) => prev.map((b) => (b.ID === id ? { ...b, [field]: updated[field] ?? base64 } : b)));
    } catch (e: any) {
      alert(e.message || 'Error al subir el PDF');
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleDelete = async (id: number, field: 'FICHATECNICA' | 'FICHASEGURIDAD') => {
    const key = `${id}-${field}`;
    setUploading((prev) => ({ ...prev, [key]: true }));
    setDeleteConfirm(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bases/${id}`, {
        method: 'PUT',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: null }),
      });
      if (!res.ok) throw new Error('No se pudo eliminar el PDF');
      setBases((prev) => prev.map((b) => (b.ID === id ? { ...b, [field]: null } : b)));
    } catch (e: any) {
      alert(e.message || 'Error al eliminar el PDF');
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }));
    }
  };

  // ── PDF cell ──────────────────────────────────────────────────────────────
  const renderPdfCell = (base: Base, field: 'FICHATECNICA' | 'FICHASEGURIDAD') => {
    const key = `${base.ID}-${field}`;
    const isUp = uploading[key];
    const hasPdf = !!base[field];
    const inputId = `pdf-${key}`;
    const label = field === 'FICHATECNICA' ? 'F. Técnica' : 'F. Seguridad';

    if (isUp) {
      return (
        <div className="flex justify-center py-1">
          <Loader2 className="w-4 h-4 text-[#CC5200] animate-spin" />
        </div>
      );
    }

    if (hasPdf) {
      return (
        <div className="flex flex-col items-center gap-1.5">
          {/* Status badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">OK</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPdfViewer({ data: base[field]!, title: `${base.CODIGO} – ${label}` })}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#CC5200]/10 hover:bg-[#CC5200]/25 border border-[#CC5200]/20 text-[#CC5200] text-[9px] font-bold uppercase tracking-wide transition-all active:scale-95"
              title="Ver PDF"
            >
              <Eye className="w-3 h-3" /> Ver
            </button>
            <button
              onClick={() => setDeleteConfirm({ id: base.ID, field })}
              className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 transition-all active:scale-95"
              title="Eliminar"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <input id={inputId} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(base.ID, field, f); e.target.value = ''; }} />
        </div>
      );
    }

    return (
      <div className="flex justify-center">
        <label
          htmlFor={inputId}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-[#CC5200]/15 border border-slate-700 hover:border-[#CC5200]/40 text-slate-400 hover:text-[#CC5200] text-[9px] font-bold uppercase tracking-wide cursor-pointer transition-all active:scale-95"
        >
          <Upload className="w-3 h-3" /> Agregar
        </label>
        <input id={inputId} type="file" accept="application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(base.ID, field, f); e.target.value = ''; }} />
      </div>
    );
  };

  if (!isOpen) return null;

  const hasActiveFilters = !!(selectedGrupo || selectedProducto);

  return (
    <>
      {/* ── Full-screen overlay ── */}
      <div className="fixed inset-0 z-[60000] flex flex-col bg-[#0A0F14] text-slate-200 font-sans">

        {/* ── Header ── */}
        <header className="flex-shrink-0 flex items-center gap-4 bg-[#CC5200] shadow-xl px-4 py-3.5">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-black/20 hover:bg-black/35 text-white transition-all active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-xl bg-white/10 border border-white/15 flex-shrink-0">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white uppercase tracking-wide leading-none truncate">
                Fichas Técnicas
              </h1>
              <p className="text-[11px] text-white/60 mt-0.5 tracking-wide">
                {isLoading ? 'Cargando…' : `${bases.length} base${bases.length !== 1 ? 's' : ''} cargadas`}
              </p>
            </div>
          </div>
        </header>

        {/* ── Search + Filters ── */}
        <div className="flex-shrink-0 px-4 pt-3 pb-3 space-y-3 bg-[#0A0F14] border-b border-slate-800/80">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código o descripción…"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#CC5200]/60 focus:ring-2 focus:ring-[#CC5200]/10 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter row */}
          <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {/* Grupo */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => { setShowGrupoFilter(v => !v); setShowProductoFilter(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all ${
                  selectedGrupo
                    ? 'bg-[#CC5200]/15 border-[#CC5200]/40 text-[#CC5200]'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                Grupo{selectedGrupo ? ` · ${selectedGrupo.slice(0, 12)}` : ''}
                <ChevronDown className={`w-3 h-3 transition-transform ${showGrupoFilter ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showGrupoFilter && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                    className="absolute top-full mt-2 left-0 z-20 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl min-w-[180px] max-h-[240px] overflow-y-auto"
                  >
                    <div
                      onClick={() => { setSelectedGrupo(''); setShowGrupoFilter(false); }}
                      className="px-4 py-3 text-xs cursor-pointer hover:bg-slate-800 text-slate-500 border-b border-slate-800"
                    >
                      — Todos los grupos
                    </div>
                    {grupos.map((g) => (
                      <div
                        key={g}
                        onClick={() => { setSelectedGrupo(g); setShowGrupoFilter(false); }}
                        className={`px-4 py-3 text-xs cursor-pointer hover:bg-slate-800 transition-colors ${
                          selectedGrupo === g ? 'text-[#CC5200] font-bold' : 'text-slate-300'
                        }`}
                      >
                        {g}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Producto */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => { setShowProductoFilter(v => !v); setShowGrupoFilter(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all ${
                  selectedProducto
                    ? 'bg-[#CC5200]/15 border-[#CC5200]/40 text-[#CC5200]'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                Producto{selectedProducto ? ` · ${selectedProducto.slice(0, 10)}` : ''}
                <ChevronDown className={`w-3 h-3 transition-transform ${showProductoFilter ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showProductoFilter && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                    className="absolute top-full mt-2 left-0 z-20 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl min-w-[200px] max-h-[240px] overflow-y-auto"
                  >
                    <div
                      onClick={() => { setSelectedProducto(''); setShowProductoFilter(false); }}
                      className="px-4 py-3 text-xs cursor-pointer hover:bg-slate-800 text-slate-500 border-b border-slate-800"
                    >
                      — Todos los productos
                    </div>
                    {productos.map((p) => (
                      <div
                        key={p}
                        onClick={() => { setSelectedProducto(p); setShowProductoFilter(false); }}
                        className={`px-4 py-3 text-xs cursor-pointer hover:bg-slate-800 transition-colors ${
                          selectedProducto === p ? 'text-[#CC5200] font-bold' : 'text-slate-300'
                        }`}
                      >
                        {p}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Clear active filters */}
            {hasActiveFilters && (
              <button
                onClick={() => { setSelectedGrupo(''); setSelectedProducto(''); }}
                className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
              >
                <X className="w-3 h-3" /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-auto" onClick={() => { setShowGrupoFilter(false); setShowProductoFilter(false); }}>

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col justify-center items-center gap-4 py-32">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}>
                <Loader2 className="w-8 h-8 text-[#CC5200]" />
              </motion.div>
              <p className="text-xs text-slate-600 uppercase tracking-widest">Cargando bases…</p>
            </div>
          )}

          {/* Error */}
          {error && !isLoading && (
            <div className="flex flex-col items-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-red-900/20 border border-red-800/30 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-slate-300 font-semibold text-sm">Error al cargar</p>
                <p className="text-slate-500 text-xs mt-1">{error}</p>
              </div>
              <button
                onClick={fetchBases}
                className="px-6 py-2 rounded-xl bg-[#CC5200]/15 hover:bg-[#CC5200]/25 border border-[#CC5200]/30 text-[#CC5200] text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !error && bases.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-28 gap-5"
            >
              <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-xl">
                <Inbox className="w-9 h-9 text-slate-700" />
              </div>
              <div className="text-center">
                <p className="text-slate-300 font-semibold text-base">Sin resultados</p>
                <p className="text-slate-600 text-sm mt-1 px-8">No se encontraron bases con los filtros aplicados.</p>
              </div>
            </motion.div>
          )}

          {/* Table */}
          {!isLoading && !error && bases.length > 0 && (
            <div className="min-w-0">
              {/* Column headers */}
              <div className="sticky top-0 z-10 grid grid-cols-[1fr_1.6fr_100px_100px] bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-4 py-2.5">
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Código</span>
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Descripción</span>
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest text-center">F. Técnica</span>
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest text-center">F. Seguridad</span>
              </div>

              <AnimatePresence initial={false}>
                {bases.map((base, idx) => (
                  <motion.div
                    key={base.ID}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(idx, 25) * 0.018 }}
                    className="grid grid-cols-[1fr_1.6fr_100px_100px] items-center px-4 py-3.5 border-b border-slate-800/60 hover:bg-slate-900/50 transition-colors"
                  >
                    {/* Código */}
                    <div>
                      <span className="text-xs font-bold text-[#CC5200] uppercase tracking-wider">{base.CODIGO || '—'}</span>
                      {base.GRUPO && (
                        <div className="mt-0.5">
                          <span className="text-[9px] text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded-md">{base.GRUPO}</span>
                        </div>
                      )}
                    </div>

                    {/* Descripción */}
                    <div className="pr-2">
                      <p className="text-xs text-slate-200 leading-snug line-clamp-2">{base.DESCRIPCIO || '—'}</p>
                      {base.PRODUCTO && (
                        <p className="text-[9px] text-slate-500 mt-0.5 truncate">{base.PRODUCTO}</p>
                      )}
                    </div>

                    {/* Ficha Técnica */}
                    <div>{renderPdfCell(base, 'FICHATECNICA')}</div>

                    {/* Ficha Seguridad */}
                    <div>{renderPdfCell(base, 'FICHASEGURIDAD')}</div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Footer count */}
              <div className="py-6 text-center">
                <p className="text-[10px] text-slate-700 uppercase tracking-widest">
                  — {bases.length} registro{bases.length !== 1 ? 's' : ''} —
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Delete confirmation modal ── */}
      <AnimatePresence>
        {deleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70001] bg-black/70 backdrop-blur-sm"
              onClick={() => setDeleteConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed z-[70002] inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto bg-slate-900 border border-slate-700/80 rounded-3xl p-7 shadow-2xl"
            >
              <div className="flex flex-col items-center gap-3 text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-red-900/30 border border-red-800/40 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-base font-bold text-white">¿Eliminar PDF?</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Se eliminará la{' '}
                  <span className="text-white font-semibold">
                    {deleteConfirm.field === 'FICHATECNICA' ? 'ficha técnica' : 'ficha de seguridad'}
                  </span>{' '}
                  de esta base. Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm.id, deleteConfirm.field)}
                  className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-red-900/30"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── PDF Viewer ── */}
      <AnimatePresence>
        {pdfViewer && (
          <PDFViewer
            base64Data={pdfViewer.data}
            title={pdfViewer.title}
            onClose={() => setPdfViewer(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
