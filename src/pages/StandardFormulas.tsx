import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Beaker, Filter, ChevronUp, ClipboardCheck, Tag, Box, Scroll } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

export default function StandardFormulas({ onLogout }: { onLogout: () => void }) {
    const navigate = useNavigate();
    const [formulas, setFormulas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    const [marcas, setMarcas] = useState<any[]>([]);
    const [cartas, setCartas] = useState<any[]>([]);
    const [productos, setProductos] = useState<any[]>([]);

    const [selectedIDMarca, setSelectedIDMarca] = useState('');
    const [selectedIDProducto, setSelectedIDProducto] = useState('');
    const [selectedIDCarta, setSelectedIDCarta] = useState('');

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    const [selectedFormula, setSelectedFormula] = useState<any>(null);
    const [showDetail, setShowDetail] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch initial data (Filters)
    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem('token');
            try {
                const [resM, resC, resP] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/marcas`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE_URL}/api/cartas`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE_URL}/api/productos-standard`, { headers: { Authorization: `Bearer ${token}` } }),
                ]);

                if (resM.ok) setMarcas(await resM.json());
                if (resC.ok) setCartas(await resC.json());
                if (resP.ok) setProductos(await resP.json());
            } catch (err) {
                console.error("Error fetching filters:", err);
            }
        };
        fetchData();
    }, []);

    const observer = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useCallback((node: any) => {
        if (loading || loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prev => prev + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, loadingMore, hasMore]);

    useEffect(() => {
        setFormulas([]);
        setPage(1);
        setHasMore(true);
    }, [debouncedSearchTerm, selectedIDMarca, selectedIDProducto, selectedIDCarta]);

    useEffect(() => {
        const fetchFormulas = async () => {
            const token = localStorage.getItem('token');
            if (page === 1) setLoading(true);
            else setLoadingMore(true);

            try {
                let url = `${API_BASE_URL}/api/formulas-standard?page=${page}&limit=25&q=${encodeURIComponent(debouncedSearchTerm)}`;
                if (selectedIDMarca) url += `&idmarca=${selectedIDMarca}`;
                if (selectedIDProducto) url += `&idproducto=${selectedIDProducto}`;
                if (selectedIDCarta) url += `&idcarta=${selectedIDCarta}`;

                const response = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.status === 401 || response.status === 403) {
                    onLogout();
                    return;
                }

                const data = await response.json();
                if (page === 1) setFormulas(data);
                else setFormulas(prev => [...prev, ...data]);

                setHasMore(data.length === 25);
            } catch (err) {
                console.error("Error fetching standard formulas:", err);
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        };

        fetchFormulas();
    }, [page, debouncedSearchTerm, selectedIDMarca, selectedIDProducto, selectedIDCarta]);

    const handleFormulaClick = (f: any) => {
        // Standard formulas usually use different field names in DB than Personal ones
        // We map them to match DetalleFormula expectations
        const mapped = {
            ...f,
            NOMBREFORMULA: f.NOMBRE,
            L: f.L, A: f.A, B: f.B,
            LO: f.LO, AO: f.AO, BO: f.BO,
            DELTA: f.DELTA,
            PRODUCTO: f.producto?.PRODUCTO || f.PRODUCTO,
            CBASE: f.BASE,
            // Map other fields as needed
        };
        setSelectedFormula(mapped);
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
                    name: formula.NOMBRE || 'Estándar'
                }
            }
        });
    };

    return (
        <div className="min-h-screen bg-[#0A0F14] text-slate-200 font-sans flex flex-col overflow-x-hidden">
            <header className="fixed top-0 z-10 flex w-full items-center justify-between border-b border-black/10 bg-[#CC5200] shadow-lg px-4 py-4">
                <button onClick={() => navigate(-1)} className="p-2 text-black hover:text-white transition-colors">
                    <ArrowLeft className="h-6 w-6 text-black" />
                </button>
                <h1 className="text-lg font-semibold uppercase tracking-tight text-white">Fórmulas Standard</h1>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 rounded-lg transition-all ${showFilters ? 'bg-black/20 text-white' : 'text-black hover:bg-black/10'}`}
                >
                    <Filter className="h-5 w-5 text-black" />
                </button>
            </header>

            <main className="pt-24 px-4 max-w-2xl mx-auto w-full flex-grow">
                {/* Search Bar */}
                <div className="relative mb-4">
                    <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre de color..."
                        className="w-full rounded-xl bg-slate-900 border border-slate-800 py-3 pr-4 pl-11 text-sm text-white focus:ring-2 focus:ring-[#B85D00]/40 focus:border-[#B85D00] outline-none transition-all placeholder:text-slate-600"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Filters Panel */}
                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mb-6 space-y-3"
                        >
                            <div className="grid grid-cols-1 gap-3 p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Tag className="h-3 w-3" /> Marca
                                    </label>
                                    <select
                                        value={selectedIDMarca}
                                        onChange={e => setSelectedIDMarca(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:border-[#B85D00]"
                                    >
                                        <option value="">Todas las marcas</option>
                                        {marcas.map(m => <option key={m.ID} value={m.ID}>{m.NOMBRE}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Box className="h-3 w-3" /> Producto
                                    </label>
                                    <select
                                        value={selectedIDProducto}
                                        onChange={e => setSelectedIDProducto(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:border-[#B85D00]"
                                    >
                                        <option value="">Todos los productos</option>
                                        {productos.map(p => <option key={p.ID} value={p.ID}>{p.PRODUCTO}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Scroll className="h-3 w-3" /> Carta
                                    </label>
                                    <select
                                        value={selectedIDCarta}
                                        onChange={e => setSelectedIDCarta(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:border-[#B85D00]"
                                    >
                                        <option value="">Todas las cartas</option>
                                        {cartas.map(c => <option key={c.ID} value={c.ID}>{c.CARTA}</option>)}
                                    </select>
                                </div>

                                <button
                                    onClick={() => { setSelectedIDMarca(''); setSelectedIDProducto(''); setSelectedIDCarta(''); setSearchTerm(''); }}
                                    className="mt-2 text-[10px] font-bold text-[#B85D00] uppercase tracking-widest hover:text-[#9E4F00] transition-colors"
                                >
                                    Limpiar Filtros
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="formula-spinner"></div>
                    </div>
                ) : formulas.length > 0 ? (
                    <div className="grid gap-4">
                        {formulas.map((f, index) => (
                            <motion.div
                                key={f.id}
                                ref={formulas.length === index + 1 ? lastElementRef : null}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={() => handleFormulaClick(f)}
                                className="elegant-card flex overflow-hidden cursor-pointer active:scale-[0.98] transition-all hover:border-slate-700"
                            >
                                <div
                                    className="w-20 min-w-[5rem] border-r border-slate-800"
                                    style={{
                                        backgroundColor: getFormulaColor(f)
                                    }}
                                />
                                <div className="flex-grow p-4">
                                    <h3 className="text-sm font-bold text-white mb-1">{f.NOMBRE}</h3>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {f.marca && <span className="formula-card__base-badge">{f.marca.NOMBRE}</span>}
                                        {f.producto && <span className="formula-card__code text-[8px]">{f.producto.PRODUCTO}</span>}
                                    </div>
                                    <button
                                        onClick={(e) => handleQualityControl(e, f)}
                                        className="formula-card__qc-btn w-full"
                                    >
                                        <ClipboardCheck className="h-3 w-3" />
                                        Control de Calidad
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                        {loadingMore && (
                            <div className="flex justify-center py-4">
                                <div className="formula-spinner formula-spinner--sm"></div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-20 text-slate-600 bg-slate-900/20 rounded-2xl border border-dashed border-slate-800">
                        <Beaker className="h-10 w-10 mx-auto mb-4 text-slate-800" />
                        <p className="text-sm italic">No se encontraron fórmulas con los filtros seleccionados.</p>
                    </div>
                )}
            </main>

            <DetalleFormula
                formula={selectedFormula}
                isOpen={showDetail}
                onClose={() => setShowDetail(false)}
            />
        </div>
    );
}
