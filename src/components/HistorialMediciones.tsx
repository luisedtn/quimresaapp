import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { X, Search, Calendar, Layers, Library, Filter } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface Medicion {
  id: number;
  nombre: string;
  fecha: string;
  hex: string | null;
  L: number | null;
  A: number | null;
  B: number | null;
  R: number | null;
  G: number | null;
  RB: number | null;
  C: number | null;
  H: number | null;
  notas: string | null;
  id_libreria: number | null;
  id_coleccion: number | null;
  libreriaObj?: { id: number; nombre: string } | null;
  coleccionObj?: { id: number; nombre: string } | null;
  blanco_referencia?: string | null;
  modo_medicion?: string | null;
  densidad?: string | null;
}

interface Libreria {
  id: number;
  nombre: string;
}

interface Coleccion {
  id: number;
  nombre: string;
}

interface HistorialMedicionesProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMeasurement?: (medicion: Medicion) => void;
}

export default function HistorialMediciones({ isOpen, onClose, onSelectMeasurement }: HistorialMedicionesProps) {
  const [mediciones, setMediciones] = useState<Medicion[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [libraries, setLibraries] = useState<Libreria[]>([]);
  const [collections, setCollections] = useState<Coleccion[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);

  const [showFilters, setShowFilters] = useState(false);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    const userDataStr = localStorage.getItem('userData');
    const userDataObj = userDataStr ? JSON.parse(userDataStr) : null;
    const headers: any = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
    if (userDataObj?.idcliente) {
      headers['x-client-id'] = userDataObj.idcliente.toString();
    }
    return headers;
  }, []);

  const fetchMediciones = useCallback(async (pageNum: number, reset: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', pageNum.toString());
      params.set('limit', '20');
      if (searchInput) params.set('search', searchInput);
      if (selectedLibraryId) params.set('id_libreria', selectedLibraryId.toString());
      if (selectedCollectionId) params.set('id_coleccion', selectedCollectionId.toString());

      const res = await fetch(`${API_BASE_URL}/api/mediciones?${params}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (reset) {
          setMediciones(data.mediciones);
        } else {
          setMediciones(prev => [...prev, ...data.mediciones]);
        }
        setTotal(data.total);
        setHasMore(pageNum * 20 < data.total);
        setPage(pageNum);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [searchInput, selectedLibraryId, selectedCollectionId, getHeaders]);

  const fetchLibraries = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/librerias`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLibraries(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCollections = async (libId: number | null) => {
    if (!libId) {
      setCollections([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/librerias/${libId}/colecciones`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCollections(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSearchInput('');
      setSelectedLibraryId(null);
      setSelectedCollectionId(null);
      setPage(1);
      setMediciones([]);
      setShowFilters(false);
      fetchLibraries();
      fetchMediciones(1, true);
    }
  }, [isOpen]);

  useEffect(() => {
    fetchCollections(selectedLibraryId);
    setSelectedCollectionId(null);
  }, [selectedLibraryId]);

  const handleSearch = () => {
    setSearchInput(search);
    fetchMediciones(1, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setSelectedLibraryId(null);
    setSelectedCollectionId(null);
    setTimeout(() => fetchMediciones(1, true), 0);
  };

  const handleLibraryFilter = (libId: number | null) => {
    setSelectedLibraryId(libId);
    setTimeout(() => fetchMediciones(1, true), 0);
  };

  const handleCollectionFilter = (colId: number | null) => {
    setSelectedCollectionId(colId);
    setTimeout(() => fetchMediciones(1, true), 0);
  };

  const fmt = (val: any) => {
    const n = Number(val);
    return isNaN(n) ? val : n.toFixed(2);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm pt-12 pb-6 px-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0A0F14] shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-6rem)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Historial de Mediciones</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">
              {total > 0 ? `${total} medicion${total !== 1 ? 'es' : ''}` : 'Cargando...'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="px-6 pt-4 pb-2 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-[#d4af37] dark:focus:border-[#d4af37] transition-all font-medium"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2.5 bg-[#d4af37] hover:bg-[#e6c84d] text-slate-900 font-bold text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95"
            >
              Buscar
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 border rounded-xl transition-all active:scale-95 ${showFilters
                ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-[#d4af37]'
                : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white'
                }`}
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>

          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex flex-wrap gap-3 pt-2 pb-1"
            >
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1.5">Librería</label>
                <select
                  value={selectedLibraryId ?? ''}
                  onChange={(e) => handleLibraryFilter(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-white outline-none focus:border-[#d4af37] dark:focus:border-[#d4af37] font-medium appearance-none cursor-pointer"
                >
                  <option value="">Todas las librerías</option>
                  {libraries.map(lib => (
                    <option key={lib.id} value={lib.id}>{lib.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1.5">Colección</label>
                <select
                  value={selectedCollectionId ?? ''}
                  onChange={(e) => handleCollectionFilter(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-white outline-none focus:border-[#d4af37] dark:focus:border-[#d4af37] font-medium appearance-none cursor-pointer"
                  disabled={!selectedLibraryId}
                >
                  <option value="">Todas las colecciones</option>
                  {collections.map(col => (
                    <option key={col.id} value={col.id}>{col.nombre}</option>
                  ))}
                </select>
              </div>
              {(searchInput || selectedLibraryId || selectedCollectionId) && (
                <button
                  onClick={clearFilters}
                  className="self-end pb-1 text-[10px] font-bold text-[#d4af37] hover:text-[#e6c84d] uppercase tracking-widest transition-colors"
                >
                  Limpiar filtros
                </button>
              )}
            </motion.div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-2 custom-scrollbar">
          {loading && mediciones.length === 0 ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 dark:bg-slate-900/50 rounded-2xl animate-pulse border border-slate-200 dark:border-slate-800" />
            ))
          ) : mediciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-4">
                <Layers className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-500">No hay mediciones</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">
                {searchInput || selectedLibraryId ? 'Intenta con otros filtros' : 'Aún no has guardado ninguna medición'}
              </p>
            </div>
          ) : (
            mediciones.map((m, idx) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => { onSelectMeasurement?.(m); onClose(); }}
                className="flex items-center gap-4 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-[#d4af37]/10 dark:hover:bg-[#d4af37]/10 hover:border-[#d4af37]/40 transition-all cursor-pointer group"
              >
                <div
                  className="h-12 w-12 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner flex-shrink-0"
                  style={{ backgroundColor: m.hex || '#cccccc' }}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{m.nombre}</h4>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 dark:text-slate-500 font-medium">
                    <Calendar className="h-3 w-3 flex-shrink-0" />
                    <span>{new Date(m.fecha).toLocaleDateString()} {new Date(m.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {(m.libreriaObj || m.coleccionObj) && (
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 dark:text-slate-600 font-medium">
                      {m.libreriaObj && (
                        <span className="flex items-center gap-1">
                          <Library className="h-2.5 w-2.5" />
                          {m.libreriaObj.nombre}
                        </span>
                      )}
                      {m.libreriaObj && m.coleccionObj && <span className="text-slate-300 dark:text-slate-700">/</span>}
                      {m.coleccionObj && (
                        <span className="flex items-center gap-1">
                          <Layers className="h-2.5 w-2.5" />
                          {m.coleccionObj.nombre}
                        </span>
                      )}
                    </div>
                  )}
                  {(m.blanco_referencia || m.modo_medicion || m.densidad) && (
                    <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-slate-400 dark:text-slate-600 font-medium flex-wrap">
                      {m.blanco_referencia && <span>{m.blanco_referencia.replace('/', ', ')}</span>}
                      {m.modo_medicion && <span className="text-slate-300 dark:text-slate-700">·</span>}
                      {m.modo_medicion && <span>{m.modo_medicion}</span>}
                      {m.densidad && <span className="text-slate-300 dark:text-slate-700">·</span>}
                      {m.densidad && <span>{m.densidad}</span>}
                    </div>
                  )}
                </div>
                {m.hex && (
                  <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded-md hidden sm:block">
                    {m.hex}
                  </span>
                )}
              </motion.div>
            ))
          )}

          {hasMore && (
            <div className="py-4 text-center">
              <button
                onClick={() => fetchMediciones(page + 1, false)}
                disabled={loading}
                className="px-6 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Cargando...' : 'Cargar más'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
