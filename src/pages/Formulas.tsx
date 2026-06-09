import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Beaker, Calendar, User, Tag, ChevronUp, ClipboardCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { API_BASE_URL } from '../config';
import DetalleFormula from '../components/DetalleFormula';

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
  const gamma = (c: number) => Math.round(Math.max(0, Math.min(255, ((c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c)) * 255)));
  return `#${gamma(rl).toString(16).padStart(2, '0')}${gamma(gl).toString(16).padStart(2, '0')}${gamma(bl).toString(16).padStart(2, '0')}`;
}

const getFormulaColor = (f: any) => {
  const l = f.L !== undefined && f.L !== null ? f.L : f.l;
  const a = f.A !== undefined && f.A !== null ? f.A : f.a;
  const b = f.B !== undefined && f.B !== null ? f.B : f.b;
  if (l === undefined || l === null || l === '') return '#1e293b';
  return labToHex(parseFloat(String(l)), parseFloat(String(a || '0')), parseFloat(String(b || '0')));
};

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
    console.log(`[FORMULAS] Reset por cambio de filtro | sortBy=${sortBy} | search="${debouncedSearchTerm}"`);
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
        const userDataStr = localStorage.getItem('userData');
        const userData = userDataStr ? JSON.parse(userDataStr) : null;

        const url = `${API_BASE_URL}/api/formulas?page=${page}&limit=25&q=${encodeURIComponent(debouncedSearchTerm)}&sortBy=${sortBy}`;

        console.log(`[FORMULAS] Solicitando página ${page} | sortBy=${sortBy} | url=${url}`);

        const headers: any = { 'Authorization': `Bearer ${token}` };
        if (userData?.idcliente) {
          headers['x-client-id'] = userData.idcliente.toString();
        }

        const response = await fetch(
          url,
          {
            headers,
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

        const sortLabel = sortBy === 'FECHA' ? 'fecha (más reciente)' : 'nombre (alfabético)';
        console.log(`[FORMULAS] Recibidos ${data.length} registros | sortBy=${sortBy} (${sortLabel}) | page=${page}`, JSON.stringify(data, null, 2));

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

  const handleQualityControl = (e: React.MouseEvent, formula: any) => {
    e.stopPropagation();
    navigate('/quality-control', {
      state: {
        standardFromFormula: {
          l: parseFloat(formula.L || '0'),
          a: parseFloat(formula.A || '0'),
          b: parseFloat(formula.B || '0'),
          name: formula.NOMBREFORMULA || 'Patrón de Fórmula'
        }
      }
    });
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
    <div className="min-h-screen bg-[#0A0F14] text-slate-200 font-sans flex flex-col overflow-x-hidden">
      {/* ── Header ── */}
      <header className="fixed top-0 z-10 flex w-full items-center justify-between border-b border-black/10 bg-[#CC5200] shadow-lg px-4 py-4">
        <button onClick={() => navigate(-1)} className="p-2 text-black hover:text-white transition-colors">
          <ArrowLeft className="h-6 w-6 text-black" />
        </button>
        <h1 className="text-lg font-semibold uppercase tracking-tight text-white">Fórmulas Personales</h1>
        <div className="w-10"></div>
      </header>

      <main className="pt-24 px-4 max-w-2xl mx-auto w-full flex-grow">
        {/* ── Search Bar ── */}
        <div className="relative mb-4">
          <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, lote, cliente o código..."
            className="w-full rounded-xl bg-slate-900 border border-slate-800 py-3 pr-4 pl-11 text-sm text-white focus:ring-2 focus:ring-[#1B6FA8]/50 focus:border-[#1B6FA8] outline-none transition-all placeholder:text-slate-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* ── Sort Toggle ── */}
        <div className="flex gap-2 mb-6 items-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mr-2">Ordenar:</span>
          <button
            onClick={() => setSortBy('FECHA')}
            className={`formula-sort-btn ${sortBy === 'FECHA' ? 'formula-sort-btn--active' : ''}`}
          >
            Más Reciente
          </button>
          <button
            onClick={() => setSortBy('NOMBREFORMULA')}
            className={`formula-sort-btn ${sortBy === 'NOMBREFORMULA' ? 'formula-sort-btn--active' : ''}`}
          >
            Nombre
          </button>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="formula-spinner"></div>
          </div>
        ) : formulas.length > 0 ? (
          <>
            <div className="grid gap-4">
              {formulas.map((formula, index) => {
                const formulaColor = getFormulaColor(formula);
                return (
                  <motion.div
                    key={`${formula.ID}-${index}`}
                    ref={formulas.length === index + 1 ? lastFormulaElementRef : null}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
                    onClick={() => handleFormulaClick(formula)}
                    className="formula-card"
                  >
                    {/* Top accent bar using formula color */}
                    <div
                      className="formula-card__accent"
                      style={{ background: `linear-gradient(90deg, ${formulaColor}, ${formulaColor}88)` }}
                    />

                    {/* Card body */}
                    <div className="formula-card__body">
                      {/* Row 1: Color circle + Name + Date */}
                      <div className="flex items-start gap-3">
                        {/* Color circle */}
                        <div
                          className="formula-card__color-circle"
                          style={{ backgroundColor: formulaColor }}
                          title="Vista de color"
                        />

                        {/* Name + Code */}
                        <div className="flex-1 min-w-0">
                          <h3 className="formula-card__name">{formula.NOMBREFORMULA}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="formula-card__code">
                              <Tag className="h-3 w-3 shrink-0" />
                              {formula.CODIGO || 'SIN CÓDIGO'}
                            </span>
                            {formula.LOTE && (
                              <span className="formula-card__lote">
                                Lote: {formula.LOTE}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Date + Base badge (right) */}
                        <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
                          {formula.FECHA && (
                            <div className="formula-card__date">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span>{formatDate(formula.FECHA)}</span>
                            </div>
                          )}
                          {formula.CBASE && (
                            <div className="formula-card__base-badge">
                              {formula.CBASE}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Client name */}
                      {formula.NOMBRECLI && (
                        <div className="formula-card__client">
                          <User className="h-3 w-3 shrink-0" />
                          <span>{formula.NOMBRECLI}</span>
                        </div>
                      )}

                      {/* Row 3: LAB Values + Quality Control */}
                      <div className="flex items-center gap-3 mt-3">
                        {/* LAB values - compact inline */}
                        <div className="formula-card__lab-row">
                          <div className="formula-card__lab-item">
                            <span className="formula-card__lab-label">L*</span>
                            <span className="formula-card__lab-value">{parseFloat(formula.L || '0').toFixed(2)}</span>
                          </div>
                          <div className="formula-card__lab-divider" />
                          <div className="formula-card__lab-item">
                            <span className="formula-card__lab-label">a*</span>
                            <span className="formula-card__lab-value">{parseFloat(formula.A || '0').toFixed(2)}</span>
                          </div>
                          <div className="formula-card__lab-divider" />
                          <div className="formula-card__lab-item">
                            <span className="formula-card__lab-label">b*</span>
                            <span className="formula-card__lab-value">{parseFloat(formula.B || '0').toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Quality control button */}
                        <button
                          onClick={(e) => handleQualityControl(e, formula)}
                          className="formula-card__qc-btn"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Control de Calidad</span>
                          <span className="sm:hidden">QC</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {loadingMore && (
              <div className="flex justify-center py-8">
                <div className="formula-spinner formula-spinner--sm"></div>
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
            className="formula-fab"
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
