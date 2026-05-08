import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Beaker, Calendar, User, Tag, ChevronUp } from 'lucide-react';
import { motion } from 'motion/react';
import { API_BASE_URL } from '../config';
import DetalleFormula from '../components/DetalleFormula';

interface FormulasProps {
  email: string | null | undefined;
  onLogout: () => void;
}

export default function Formulas({ email, onLogout }: FormulasProps) {
  const navigate = useNavigate();
  const [formulas, setFormulas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'FECHA' | 'NOMBREFORMULA'>('FECHA');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectedFormula, setSelectedFormula] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastFormulaElementRef = useCallback((node: any) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  useEffect(() => {
    // Reset state when filters change
    setFormulas([]);
    setPage(1);
    setHasMore(true);
  }, [debouncedSearchTerm, sortBy]);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchFormulas = async () => {
      const token = localStorage.getItem('token');
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const url = `${API_BASE_URL}/api/formulas?page=${page}&limit=25&q=${encodeURIComponent(debouncedSearchTerm)}&sortBy=${sortBy}`;
        console.log(`[FRONTEND] Fetching formulas from URL: ${url}`);
        const response = await fetch(
          url,
          {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: abortController.signal
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[FRONTEND] Server responded with error:', errorData);
          if (response.status === 401 || response.status === 403) {
            onLogout();
          }
          throw new Error('Error al obtener fórmulas');
        }

        const data = await response.json();
        console.log(`[FRONTEND] Received ${data.length} formulas`, data);

        if (page === 1) {
          setFormulas(data);
        } else {
          setFormulas(prev => [...prev, ...data]);
        }

        setHasMore(data.length === 25);
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('Fetch Error (Formulas):', error);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };

    fetchFormulas();
    return () => abortController.abort();
  }, [page, debouncedSearchTerm, sortBy]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFormulaClick = (formula: any) => {
    setSelectedFormula(formula);
    setShowDetail(true);
  };

  // Helper to format date string
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

  return (
    <div className="min-h-screen bg-[#0A0F14] text-slate-200 font-sans flex flex-col">
      <header className="fixed top-0 z-10 flex w-full items-center justify-between border-b border-slate-800 bg-[#0A0F14]/80 backdrop-blur-md px-4 py-4">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold uppercase tracking-tight">Fórmulas Personales</h1>
        <div className="w-10"></div>
      </header>

      <main className="pt-24 px-4 max-w-2xl mx-auto w-full flex-grow">
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, lote, cliente o código..."
            className="w-full rounded-xl bg-slate-900 border border-slate-800 py-3 pr-4 pl-11 text-sm text-white focus:ring-2 focus:ring-[#004A99]/50 focus:border-[#004A99] outline-none transition-all placeholder:text-slate-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Sorting Toggles */}
        <div className="flex gap-2 mb-8 items-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mr-2">Ordenar por:</span>
          <button
            onClick={() => setSortBy('FECHA')}
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${sortBy === 'FECHA'
              ? 'bg-[#c07204] border-[#c07204] text-white'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
              }`}
          >
            Más Reciente
          </button>
          <button
            onClick={() => setSortBy('NOMBREFORMULA')}
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${sortBy === 'NOMBREFORMULA'
              ? 'bg-[#c07204] border-[#c07204] text-white'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
              }`}
          >
            Nombre
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c07204] border-t-transparent"></div>
          </div>
        ) : formulas.length > 0 ? (
          <>
            <div className="grid gap-4">
              {formulas.map((formula, index) => (
                <motion.div
                  key={`${formula.ID}-${index}`}
                  ref={formulas.length === index + 1 ? lastFormulaElementRef : null}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleFormulaClick(formula)}
                  className="elegant-card p-0 transition-all hover:border-slate-700 bg-slate-900/40 relative overflow-hidden flex cursor-pointer active:scale-[0.98]"
                >
                  {/* Color Square on the Left */}
                  <div
                    className="w-24 min-w-[6rem] border-r border-slate-800 shadow-inner"
                    style={{
                      backgroundColor: formula.L && formula.A && formula.B
                        ? `lab(${formula.L} ${formula.A} ${formula.B})`
                        : '#1e293b'
                    }}
                  >
                    <div className="h-full w-full flex flex-col items-center justify-end p-2 bg-gradient-to-t from-black/40 to-transparent">
                      <span className="text-[9px] font-bold text-white uppercase tracking-tighter">Vista Color</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-grow p-4 md:p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Tag className="h-3 w-3 text-[#c07204]" />
                          <span className="text-[10px] font-bold text-[#c07204] uppercase tracking-widest">{formula.CODIGO || 'SIN CÓDIGO'}</span>
                          {formula.LOTE && (
                            <>
                              <span className="text-slate-700">•</span>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">LOTE: {formula.LOTE}</span>
                            </>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-white tracking-tight leading-tight">{formula.NOMBREFORMULA}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <User className="h-3 w-3 text-slate-500" />
                          <p className="text-xs text-slate-400 font-medium">{formula.NOMBRECLI}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-slate-500 justify-end mb-1">
                          <Calendar className="h-3 w-3" />
                          <span className="text-[10px] font-medium">{formatDate(formula.FECHA)}</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-600 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          BASE: {formula.CBASE || 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* LAB Values */}
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <div className="bg-slate-950/50 rounded-lg p-2 border border-slate-800/50 text-center">
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">L*</p>
                        <p className="font-mono text-sm text-white font-bold">{parseFloat(formula.L || '0').toFixed(2)}</p>
                      </div>
                      <div className="bg-slate-950/50 rounded-lg p-2 border border-slate-800/50 text-center">
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">a*</p>
                        <p className="font-mono text-sm text-emerald-400 font-bold">{parseFloat(formula.A || '0').toFixed(2)}</p>
                      </div>
                      <div className="bg-slate-950/50 rounded-lg p-2 border border-slate-800/50 text-center">
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">b*</p>
                        <p className="font-mono text-sm text-amber-400 font-bold">{parseFloat(formula.B || '0').toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            {loadingMore && (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#c07204] border-t-transparent"></div>
              </div>
            )}
            {!hasMore && formulas.length > 0 && (
              <p className="text-center py-8 text-[10px] text-slate-600 uppercase tracking-widest">Fin de los resultados</p>
            )}
          </>
        ) : (
          <div className="text-center py-20 text-slate-600 bg-slate-900/20 rounded-2xl border border-dashed border-slate-800">
            <Beaker className="h-10 w-10 mx-auto mb-4 text-slate-800" />
            <p className="text-sm italic">No se encontraron fórmulas personales.</p>
          </div>
        )}
      </main>

      <footer className="p-6 text-center mt-auto">
        <p className="text-[10px] text-slate-700 uppercase tracking-widest">Base de Datos de Colorimetría Personalizada • Quimresa S.A.</p>
      </footer>

      {/* Draggable FAB Scroll to Top */}
      {showScrollTop && (
        <motion.div
          drag
          dragMomentum={false}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9, cursor: 'grabbing' }}
          className="fixed bottom-8 right-8 z-50 cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        >
          <button
            onClick={scrollToTop}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#c07204] text-white shadow-lg shadow-[#c07204]/30 hover:bg-[#a16004] transition-colors border-2 border-white/10"
          >
            <ChevronUp className="h-7 w-7" />
          </button>
        </motion.div>
      )}

      <DetalleFormula
        formula={selectedFormula}
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
      />
    </div>
  );
}
