import { motion, AnimatePresence } from 'motion/react';
import { X, Beaker, User, Calendar, Droplets, MessageSquare, ClipboardList, Activity, Loader2, FileText, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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

interface DetalleFormulaProps {
    formula: any;
    isOpen: boolean;
    onClose: () => void;
}

// ── PdfTabContent — componente de nivel superior para identidad estable ───────
interface PdfTabContentProps {
    field: 'FICHATECNICA' | 'FICHASEGURIDAD';
    hasPdf: boolean;
    label: string;
    pdfBlobUrls: Record<string, string | null>;
    pdfLoading: Record<string, boolean>;
    pdfNumPages: Record<string, number>;
    pdfContainerWidth: number;
    containerRef: React.RefObject<HTMLDivElement | null>;
    onContainerResize: (width: number) => void;
    onPageCount: (field: string, count: number) => void;
    onLoadError: (field: string) => void;
}

function PdfTabContent({
    field, hasPdf, label,
    pdfBlobUrls, pdfLoading, pdfNumPages,
    pdfContainerWidth, containerRef,
    onContainerResize, onPageCount, onLoadError
}: PdfTabContentProps) {
    useEffect(() => {
        if (!containerRef.current) return;
        const el = containerRef.current;
        const update = () => {
            const w = el.clientWidth - 32;
            onContainerResize(w > 800 ? 800 : w);
        };
        const obs = new ResizeObserver(update);
        obs.observe(el);
        update();
        return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!hasPdf) return (
        <div className="flex flex-col items-center justify-center gap-3 py-24" style={{ color: 'var(--text-muted)' }}>
            <FileText className="w-12 h-12 opacity-20" />
            <p className="text-sm font-medium italic">Sin {label}</p>
        </div>
    );
    const blobUrl = pdfBlobUrls[field];
    const isLoading = pdfLoading[field];
    if (isLoading || blobUrl === undefined) return (
        <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-orange)' }} />
        </div>
    );
    if (blobUrl === null) return (
        <div className="flex flex-col items-center justify-center gap-3 py-24" style={{ color: 'var(--text-muted)' }}>
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-sm">Error al cargar el PDF</p>
        </div>
    );
    return (
        <Document
            file={blobUrl}
            onLoadSuccess={({ numPages }) => {
                console.log(`[PdfTabContent] "${field}" cargado — ${numPages} página(s)`);
                onPageCount(field, numPages);
            }}
            onLoadError={(err) => {
                console.log(`[PdfTabContent] Error al renderizar "${field}":`, err?.message || err);
                onLoadError(field);
            }}
            loading={<div className="flex flex-col items-center gap-3 mt-16"><Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--accent-orange)' }} /></div>}
            error={<div className="flex flex-col items-center gap-3 mt-16"><AlertTriangle className="w-8 h-8 text-red-400" /><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Error renderizando el documento.</p></div>}
        >
            {Array.from(new Array(pdfNumPages[field] || 0), (_, i) => (
                <div key={`page_${i + 1}`} className="mb-4 shadow-lg rounded overflow-hidden">
                    <Page
                        pageNumber={i + 1}
                        width={pdfContainerWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        loading={<div className="animate-pulse bg-slate-700" style={{ width: pdfContainerWidth, height: 400 }} />}
                    />
                </div>
            ))}
        </Document>
    );
}

export default function DetalleFormula({ formula, isOpen, onClose }: DetalleFormulaProps) {
    const navigate = useNavigate();
    const [lotesPersonales, setLotesPersonales] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'mezcla' | 'lab' | 'procesos' | 'obs' | 'fichatecnica' | 'fichaseguridad'>('mezcla');
    const [densities, setDensities] = useState<Record<string, number>>({});
    const [calculating, setCalculating] = useState(false);
    const [componentColors, setComponentColors] = useState<Record<string, any>>({});
    const [basePdfData, setBasePdfData] = useState<{ FICHATECNICA: boolean; FICHASEGURIDAD: boolean; ID: number | null }>({ FICHATECNICA: false, FICHASEGURIDAD: false, ID: null });
    const [pdfBlobUrls, setPdfBlobUrls] = useState<Record<string, string | null>>({});
    const [pdfLoading, setPdfLoading] = useState<Record<string, boolean>>({});
    const [pdfNumPages, setPdfNumPages] = useState<Record<string, number>>({});
    const [pdfContainerWidth, setPdfContainerWidth] = useState(600);
    const pdfContainerRef = useRef<HTMLDivElement>(null);
    const [isSuper, setIsSuper] = useState<boolean | null>(() => {
        try {
            const userDataStr = localStorage.getItem('userData');
            if (userDataStr) {
                const userData = JSON.parse(userDataStr);
                if (userData && typeof userData.issuper === 'boolean') {
                    return userData.issuper;
                }
            }
        } catch (e) {
            console.error("Error reading userData for isSuper", e);
        }
        return null;
    });

    useEffect(() => {
        if (!isOpen) return;
        setIsSuper(null);
        const token = localStorage.getItem('token');
        fetch(`${API_BASE_URL}/api/cliente`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                console.log("[DetalleFormula] Datos de cliente recibidos:", data);
                if (data) {
                    const superUser = data.issuper === true;
                    console.log(`[DetalleFormula] Clasificación del cliente: ¿Es Superusuario (issuper)? ${superUser ? "SÍ (mostrar ingredientes)" : "NO (ocultar ingredientes)"}`);
                    setIsSuper(superUser);
                } else {
                    console.log("[DetalleFormula] No se recibieron datos de cliente. Definiendo issuper = false");
                    setIsSuper(false);
                }
            })
            .catch(err => {
                console.error("Error fetching client super status:", err);
                setIsSuper(false);
            });
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !formula) return;
        if (!formula.NOMBREFORMULA || !formula.ID) return;
        
        const fetchLotes = async () => {
            console.log(`[DetalleFormula] Iniciando búsqueda de lotes para la fórmula ID: ${formula.ID}, Nombre: ${formula.NOMBREFORMULA}`);
            try {
                const token = localStorage.getItem('token');
                const url = `${API_BASE_URL}/api/formpersonaleslote/${formula.ID}`;
                console.log(`[DetalleFormula] Haciendo petición a: ${url}`);
                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log(`[DetalleFormula] Respuesta HTTP recibida para lotes de la fórmula ${formula.ID}: status ${res.status}`);
                if (res.ok) {
                    const data = await res.json();
                    console.log(`[DetalleFormula] Datos de lotes recuperados exitosamente: ${data.length} registros encontrados para la fórmula ${formula.ID}`);
                    setLotesPersonales(data);
                } else {
                    console.warn(`[DetalleFormula] Respuesta no OK al obtener lotes para la fórmula ${formula.ID}: ${res.statusText}`);
                }
            } catch (err) {
                console.error(`[DetalleFormula] Error al hacer el fetch de lotes para la fórmula ${formula.ID}:`, err);
            }
        };
        fetchLotes();
    }, [isOpen, formula]);

    useEffect(() => {
        if (!isOpen || !formula) return;

        const fetchData = async () => {
            setCalculating(true);
            const codes = new Set<string>();

            console.log("FORMULAPRODUCTO", formula, formula.producto)
            const baseCodeName = formula.RESERVA;
            const baseId = formula.RESERVA;
            const baseCodePersonal = formula.CBASE;

            if (baseCodeName) {
                codes.add(baseCodeName);
            } else {
                if (baseId) {
                    codes.add(baseId);
                } else {
                    if (baseCodePersonal) codes.add(baseCodePersonal);
                }
            }

            for (let i = 1; i <= 13; i++) {
                const cCode = formula[`C${i}`];
                if (cCode) codes.add(cCode);
            }
            for (let i = 1; i <= 6; i++) {
                const aCode = formula[`A${i}`];
                if (aCode) codes.add(aCode);
            }
            for (let i = 1; i <= 2; i++) {
                const bCode = formula[`B${i}`];
                if (bCode) codes.add(bCode);
            }

            try {
                const token = localStorage.getItem('token');

                const res = await fetch(`${API_BASE_URL}/api/componentes/densidades`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ codigos: Array.from(codes) })
                });

                if (res.ok) {
                    const data = await res.json();
                    const densityMap: Record<string, number> = {};
                    data.forEach((item: any) => {
                        densityMap[item.CODIGO] = item.DENSIDAD || 1.0;
                    });
                    setDensities(densityMap);
                }

                const resCol = await fetch(`${API_BASE_URL}/api/componentes/colores`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ codigos: Array.from(codes) })
                });

                if (resCol.ok) {
                    const colorData = await resCol.json();
                    const colorMap: Record<string, any> = {};
                    colorData.forEach((item: any) => {
                        colorMap[item.code] = item;
                    });
                    setComponentColors(colorMap);
                }
            } catch (err) {
                console.error("Error fetching component data:", err);
            } finally {
                setCalculating(false);
            }
        };

        fetchData();
    }, [isOpen, formula]);

    // ── Fetch base PDF fields when formula opens ─────────────────────────────
    useEffect(() => {
        if (!isOpen || !formula) return;

        // Resetear estado de PDFs al cambiar de fórmula
        setBasePdfData({ FICHATECNICA: false, FICHASEGURIDAD: false, ID: null });
        setPdfBlobUrls({});
        setPdfLoading({});
        setPdfNumPages({});

        // Usar misma lógica robusta de resolución de código de base que los cálculos de volumen:
        // priorizar RESERVA, luego CBASE, luego IDPRODUCTO
        const baseCode = formula.RESERVA || formula.CBASE || formula.IDPRODUCTO?.toString();
        if (!baseCode) {
            console.log('[DetalleFormula] No se encontró código de base en la fórmula (RESERVA/CBASE/IDPRODUCTO)');
            return;
        }

        const token = localStorage.getItem('token');
        const userDataStr = localStorage.getItem('userData');
        const userData = userDataStr ? JSON.parse(userDataStr) : null;
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        if (userData?.idcliente) headers['x-client-id'] = userData.idcliente.toString();

        console.log(`[DetalleFormula] Buscando base en tabla BASES por CODIGO="${baseCode}"`);

        fetch(`${API_BASE_URL}/api/bases?exactCode=${encodeURIComponent(baseCode)}&limit=1`, { headers })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                const record = data?.records?.[0];
                console.log(`[DetalleFormula] Base encontrada para código "${baseCode}":`, record);
                if (record) {
                    const hasFT = record.FICHATECNICA === true || !!record.FICHATECNICA;
                    const hasFS = record.FICHASEGURIDAD === true || !!record.FICHASEGURIDAD;
                    console.log(`[DetalleFormula] FICHATECNICA ${hasFT ? '\u2713 DISPONIBLE' : '\u2717 NO DISPONIBLE'}`);
                    console.log(`[DetalleFormula] FICHASEGURIDAD ${hasFS ? '\u2713 DISPONIBLE' : '\u2717 NO DISPONIBLE'}`);
                    console.log(`[DetalleFormula] basePdfData.ID = ${record.ID}`);
                    setBasePdfData({ FICHATECNICA: hasFT, FICHASEGURIDAD: hasFS, ID: record.ID });
                } else {
                    console.log(`[DetalleFormula] No se encontró registro de base para código "${baseCode}" — PDFs no disponibles`);
                    setBasePdfData({ FICHATECNICA: false, FICHASEGURIDAD: false, ID: null });
                }
            })
            .catch(err => {
                console.log(`[DetalleFormula] Error al buscar base para código "${baseCode}":`, err);
                setBasePdfData({ FICHATECNICA: false, FICHASEGURIDAD: false, ID: null });
            });
    }, [isOpen, formula]);

    // ── Disparar carga del PDF cuando se activa el tab o cuando llega el ID de la base ──
    useEffect(() => {
        if (!isOpen) return;
        const field = activeTab === 'fichatecnica' ? 'FICHATECNICA'
            : activeTab === 'fichaseguridad' ? 'FICHASEGURIDAD'
            : null;
        if (!field) return;
        if (!basePdfData.ID) return;
        const hasPdf = field === 'FICHATECNICA' ? basePdfData.FICHATECNICA : basePdfData.FICHASEGURIDAD;
        if (!hasPdf) return;
        if (pdfBlobUrls[field] !== undefined) return;
        if (pdfLoading[field]) return;

        console.log(`[DetalleFormula] Iniciando carga PDF para "${field}" (baseId=${basePdfData.ID})`);
        setPdfLoading(prev => ({ ...prev, [field]: true }));
        const token = localStorage.getItem('token');
        fetch(`${API_BASE_URL}/api/bases/${basePdfData.ID}/pdf/${field}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.blob();
            })
            .then(blob => {
                console.log(`[DetalleFormula] PDF "${field}" recibido (${blob.size} bytes)`);
                setPdfBlobUrls(prev => ({ ...prev, [field]: URL.createObjectURL(blob) }));
            })
            .catch(err => {
                console.error(`[DetalleFormula] Error cargando PDF "${field}":`, err.message);
                setPdfBlobUrls(prev => ({ ...prev, [field]: null }));
            })
            .finally(() => {
                setPdfLoading(prev => ({ ...prev, [field]: false }));
            });
    }, [isOpen, activeTab, basePdfData.ID, basePdfData.FICHATECNICA, basePdfData.FICHASEGURIDAD]);

    if (!formula) return null;

    const getColorStyle = (code: string): React.CSSProperties => {
        const cc = componentColors[code];
        if (!cc) return { backgroundColor: '#555555' };
        if (cc.isBase && cc.baseType === 'transparent') {
            return {
                backgroundColor: '#ffffff',
                backgroundImage: 'linear-gradient(45deg, #aaa 25%, transparent 25%), linear-gradient(-45deg, #aaa 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #aaa 75%), linear-gradient(-45deg, transparent 75%, #aaa 75%)',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
            };
        }
        if (cc.isBase && cc.baseType === 'white') {
            return { backgroundColor: '#ffffff' };
        }
        return { backgroundColor: cc.rgb || '#555555' };
    };

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

    // --- CÁLCULOS DE VOLUMEN Y DENSIDAD ---
    const rawIngredients: any[] = [];
    console.log("DENSIDADES DE TODOS LOS ELEMENTOS", densities)
    const baseCodeName = formula.RESERVA;
    const baseId = formula.IDPRODUCTO?.toString();
    const baseCodePersonal = formula.CBASE;

    const baseCode = (baseCodeName && densities[baseCodeName]) ? baseCodeName :
        (baseId && densities[baseId]) ? baseId :
            (baseCodePersonal && densities[baseCodePersonal]) ? baseCodePersonal :
                (baseCodeName || baseCodePersonal || baseId);

    const baseMass = parseFloat(formula.BASE || formula.QBASE || '0');
    console.log("FORMULARECIBIDA", formula);
    console.log("BASE RECIBIDA", baseCode, baseMass);
    if (baseCode && baseMass > 0) {
        rawIngredients.push({ code: baseCode, mass: baseMass, type: 'BASE' });
    }

    for (let i = 1; i <= 13; i++) {
        const code = formula[`C${i}`];
        const mass = parseFloat(formula[`Q${i}`] || '0');
        if (code && mass > 0) {
            rawIngredients.push({ code, mass, type: 'COLORANTE' });
        }
    }
    for (let i = 1; i <= 6; i++) {
        const code = formula[`A${i}`];
        const mass = parseFloat(formula[`AQ${i}`] || '0');
        if (code && mass > 0) {
            rawIngredients.push({ code, mass, type: 'ADITIVO A' });
        }
    }
    for (let i = 1; i <= 2; i++) {
        const code = formula[`B${i}`];
        const mass = parseFloat(formula[`BQ${i}`] || '0');
        if (code && mass > 0) {
            rawIngredients.push({ code, mass, type: 'ADITIVO B' });
        }
    }

    let totalRawMass = 0;
    let totalRawVolume = 0;

    const totalMass = rawIngredients.reduce((accumulator, ing) => {
        return accumulator + (ing.mass || 0);
    }, 0);

    if (rawIngredients.length > 0) {
        rawIngredients[0].mass = 1000 - (totalMass - baseMass);
    }

    const ingredientsWithPhysics = rawIngredients.map((ing, index) => {
        const rho = densities[ing.code] || 1.0;
        const vol = ing.mass / rho;
        totalRawMass += ing.mass;
        totalRawVolume += vol;
        return { ...ing, rho, vol };
    });

    const calculatedMixtureDensity = totalRawVolume > 0 ? (totalRawMass / totalRawVolume) : 1.0;
    const volumeFactor = calculatedMixtureDensity;

    let finalMassSum = 0;
    const processedIngredients = ingredientsWithPhysics.map(ing => {
        const finalVol = ing.mass * volumeFactor;
        finalMassSum += finalVol;
        return {
            ...ing,
            ml: finalVol,
            grams: ing.mass,
            percentage: (finalVol / 10)
        };
    });

    const mixtureDensityDisplay = totalRawVolume > 0 ? (finalMassSum / 1000) : calculatedMixtureDensity;

    const processes = [
        { id: 1, text: formula.PROCESOS },
        { id: 2, text: formula.PROCESOS2 },
        { id: 3, text: formula.PROCESOS3 },
        { id: 4, text: formula.PROCESOS4 },
    ].filter(p => p.text);

    const formulaHex = getFormulaColor(formula);

    // Tab config
    const tabs = [
        { id: 'mezcla', label: 'Fórmula', icon: Droplets },
        { id: 'lab', label: 'Colorimetría', icon: Activity },
        { id: 'procesos', label: 'Procesos', icon: ClipboardList },
        { id: 'obs', label: 'Notas', icon: MessageSquare },
        { id: 'fichatecnica', label: 'F. Técnica', icon: FileText },
        { id: 'fichaseguridad', label: 'F. Seguridad', icon: AlertTriangle },
    ];


    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* ── Backdrop ── */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-md"
                    />

                    {/* ── Drawer ── */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                        className="fixed inset-x-0 bottom-0 z-[70] h-[94vh] w-full overflow-hidden rounded-t-[2.5rem] shadow-2xl flex flex-col"
                        style={{ backgroundColor: 'var(--bg-app)', borderTop: '1px solid var(--border-card)' }}
                    >
                        {/* ── Drag Handle ── */}
                        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                            <div className="h-1 w-14 rounded-full" style={{ backgroundColor: 'var(--drag-handle)' }} />
                        </div>

                        {/* ── Header ── */}
                        <div
                            className="flex-shrink-0 px-4 sm:px-6 pt-2 pb-4"
                            style={{ borderBottom: '1px solid var(--border-card)' }}
                        >
                            {/* Top row: color swatch + title + close */}
                            <div className="flex items-start justify-between mb-3 gap-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {/* Color swatch */}
                                    <div
                                        className="h-12 w-12 rounded-2xl flex-shrink-0 overflow-hidden shadow-lg"
                                        style={{
                                            backgroundColor: formulaHex
                                        }}
                                    >
                                        <div className="h-full w-full" />
                                    </div>

                                    {/* Title block */}
                                    <div className="min-w-0 flex-1">
                                        <h2
                                            className="text-lg sm:text-xl font-black leading-tight truncate"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            {formula.NOMBREFORMULA}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            {/* Código badge — naranja acento */}
                                            <span
                                                className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
                                                style={{
                                                    color: 'var(--accent-orange)',
                                                    backgroundColor: 'rgba(184,93,0,0.12)',
                                                    border: '1px solid rgba(184,93,0,0.25)'
                                                }}
                                            >
                                                {formula.CODIGO || 'SIN CÓDIGO'}
                                            </span>
                                            {/* Densidad badge */}
                                            {mixtureDensityDisplay > 0 && (
                                                <span
                                                    className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
                                                    style={{
                                                        color: 'var(--text-muted)',
                                                        backgroundColor: 'var(--bg-close-btn)',
                                                        border: '1px solid var(--border-close-btn)'
                                                    }}
                                                >
                                                    ρ {mixtureDensityDisplay.toFixed(4)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Close button */}
                                <button
                                    onClick={onClose}
                                    className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-full transition-all duration-200 active:scale-90 close-btn"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* ── Info Chips ── */}
                            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 sm:mx-0 px-4 sm:px-0 pb-0.5">
                                {/* Cliente */}
                                <div
                                    className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl"
                                    style={{
                                        backgroundColor: 'var(--bg-ingredient-card)',
                                        border: '1px solid var(--border-ingredient-card)'
                                    }}
                                >
                                    <User className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--accent-color)' }} />
                                    <p
                                        className="text-[9px] sm:text-[10px] font-bold truncate max-w-[100px] sm:max-w-[130px]"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {formula.NOMBRECLI || 'N/A'}
                                    </p>
                                </div>
                                {/* Fecha */}
                                <div
                                    className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl"
                                    style={{
                                        backgroundColor: 'var(--bg-ingredient-card)',
                                        border: '1px solid var(--border-ingredient-card)'
                                    }}
                                >
                                    <Calendar className="h-3 w-3 flex-shrink-0 text-emerald-400" />
                                    <p
                                        className="text-[9px] sm:text-[10px] font-bold whitespace-nowrap"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {formatDate(formula.FECHA)}
                                    </p>
                                </div>
                                {/* Cantidad */}
                                <div
                                    className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl"
                                    style={{
                                        backgroundColor: 'var(--bg-ingredient-card)',
                                        border: '1px solid var(--border-ingredient-card)'
                                    }}
                                >
                                    <Beaker className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--accent-orange)' }} />
                                    <p
                                        className="text-[9px] sm:text-[10px] font-bold whitespace-nowrap"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {formula.CANTIDAD || '0'} {formula.UNIDAD || 'LT'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Navigation Tabs ── */}
                        <div
                            className="flex-shrink-0 flex px-4 pb-2 sm:px-6 gap-1 overflow-x-auto no-scrollbar"
                            style={{
                                backgroundColor: 'var(--bg-tabs-nav)',
                                borderBottom: '1px solid var(--border-card)'
                            }}
                        >
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className="flex items-center gap-1.5 py-3.5 px-1 border-b-2 transition-all duration-200 whitespace-nowrap flex-shrink-0"
                                        style={{
                                            borderBottomColor: isActive ? 'var(--accent-orange)' : 'transparent',
                                            color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                                            fontWeight: isActive ? '700' : '500',
                                            marginRight: '16px'
                                        }}
                                    >
                                        <tab.icon
                                            className="h-3.5 w-3.5 transition-colors duration-200"
                                            style={{ color: isActive ? 'var(--accent-orange)' : 'var(--text-muted)' }}
                                        />
                                        <span className="text-[10px] uppercase tracking-widest">{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* ── Content Area ── */}
                        <div className="flex-grow overflow-y-auto" style={{ backgroundColor: 'var(--bg-app)' }}>

                            {/* ══ TAB: FÓRMULA ══ */}
                            {activeTab === 'mezcla' && (
                                <div className="p-4 sm:p-6 space-y-4">

                                    {/* Calculating indicator */}
                                    {calculating && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center gap-3 p-3 rounded-xl"
                                            style={{
                                                backgroundColor: 'rgba(184,93,0,0.08)',
                                                border: '1px solid rgba(184,93,0,0.2)'
                                            }}
                                        >
                                            <div
                                                className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
                                                style={{ borderColor: 'var(--accent-orange)', borderTopColor: 'transparent' }}
                                            />
                                            <p
                                                className="text-[10px] font-bold uppercase tracking-widest"
                                                style={{ color: 'var(--accent-orange)' }}
                                            >
                                                Calculando densidades y volumen...
                                            </p>
                                        </motion.div>
                                    )}

                                    {/* Lotes de Fórmula Personal */}
                                    {formula.NOMBREFORMULA && lotesPersonales && lotesPersonales.length > 0 && (
                                        <div className="mb-6 space-y-3">
                                            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Historial de Lotes</h3>
                                            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-ingredient-card)', backgroundColor: 'var(--bg-ingredient-card)' }}>
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-black/20" style={{ color: 'var(--text-muted)' }}>
                                                        <tr>
                                                            <th className="p-3 font-semibold">Lote</th>
                                                            <th className="p-3 font-semibold">Fecha</th>
                                                            <th className="p-3 font-semibold">ΔE</th>
                                                            <th className="p-3 font-semibold">L*</th>
                                                            <th className="p-3 font-semibold">a*</th>
                                                            <th className="p-3 font-semibold">b*</th>
                                                            <th className="p-3 text-center font-semibold">Acción</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {lotesPersonales.map((lote: any, idx: number) => (
                                                            <tr key={idx} className="transition-colors hover:bg-white/5 border-b last:border-b-0" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-ingredient-card)' }}>
                                                                <td className="p-3 font-medium">{lote.LOTE}</td>
                                                                <td className="p-3">{formatDate(lote.FECHA)}</td>
                                                                <td className="p-3 font-mono font-bold" style={{ color: parseFloat(lote.DELTA || '0') < 1 ? '#34d399' : '#f87171' }}>{parseFloat(lote.DELTA || '0').toFixed(2)}</td>
                                                                <td className="p-3 font-mono">{parseFloat(lote.LO || '0').toFixed(2)}</td>
                                                                <td className="p-3 font-mono">{parseFloat(lote.AO || '0').toFixed(2)}</td>
                                                                <td className="p-3 font-mono">{parseFloat(lote.BO || '0').toFixed(2)}</td>
                                                                <td className="p-3 text-center">
                                                                    <button
                                                                        onClick={() => {
                                                                            onClose();
                                                                            navigate('/quality-control', {
                                                                                state: {
                                                                                    standardFromFormula: {
                                                                                        l: parseFloat(lote.LO || '0'),
                                                                                        a: parseFloat(lote.AO || '0'),
                                                                                        b: parseFloat(lote.BO || '0'),
                                                                                        name: `${formula.NOMBREFORMULA} - Lote ${lote.LOTE}`
                                                                                    }
                                                                                }
                                                                            });
                                                                        }}
                                                                        className="bg-[#CC5200] hover:bg-[#b84a00] text-white px-3 py-1.5 rounded-lg font-bold text-[10px] tracking-wider transition-colors"
                                                                    >
                                                                        QC
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {isSuper === null ? (
                                        <div className="flex justify-center py-10">
                                            <div className="formula-spinner formula-spinner--sm"></div>
                                        </div>
                                    ) : isSuper === false ? (
                                        <div
                                            className="p-8 rounded-2xl text-center border border-dashed flex flex-col items-center justify-center gap-2"
                                            style={{
                                                backgroundColor: 'var(--bg-ingredient-card)',
                                                borderColor: 'var(--border-ingredient-card)',
                                                color: 'var(--text-muted)'
                                            }}
                                        >
                                            <Droplets className="w-8 h-8 opacity-20 mb-1" />
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                Fórmula Confidencial
                                            </p>
                                            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                                                Su cuenta no tiene privilegios para visualizar los componentes o pigmentos detallados de esta fórmula.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Column headers */}
                                            <div
                                                className="flex items-center justify-between px-2"
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                <span className="text-[9px] font-bold uppercase tracking-[0.15em]">Componente | ρ</span>
                                                <div className="flex gap-6 flex-shrink-0">
                                                    <span className="text-[9px] font-bold uppercase tracking-[0.15em]">ml</span>
                                                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] w-14 text-right">g</span>
                                                </div>
                                            </div>

                                            {/* Ingredient rows */}
                                            <div className="space-y-2">
                                                {processedIngredients.map((item, index) => {
                                                    const isBase = item.type === 'BASE';
                                                    return (
                                                        <motion.div
                                                            key={index}
                                                            initial={{ opacity: 0, x: -8 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: index * 0.04 }}
                                                            className="flex items-center justify-between p-3.5 rounded-2xl transition-all duration-200"
                                                            style={{
                                                                backgroundColor: isBase
                                                                    ? 'var(--bg-base-card)'
                                                                    : 'var(--bg-ingredient-card)',
                                                                border: isBase
                                                                    ? 'var(--border-base-card)'
                                                                    : 'var(--border-ingredient-card)',
                                                                boxShadow: isBase
                                                                    ? '0 4px 20px rgba(184,93,0,0.05)'
                                                                    : 'none'
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                {/* Color Swatch */}
                                                                <div
                                                                    className="h-9 w-9 rounded-xl flex-shrink-0 shadow-inner border border-white/10"
                                                                    style={getColorStyle(item.code)}
                                                                />
                                                                {/* Info */}
                                                                <div className="min-w-0">
                                                                    <p
                                                                        className="text-sm font-bold tracking-tight truncate"
                                                                        style={{ color: 'var(--text-primary)' }}
                                                                    >
                                                                        {item.code}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                                                        <span
                                                                            className="text-[9px] font-bold uppercase tracking-wider"
                                                                            style={{ color: 'var(--text-muted)' }}
                                                                        >
                                                                            {item.type} · ρ {item.rho.toFixed(3)}
                                                                        </span>
                                                                        <span style={{ color: 'var(--border-ingredient-card)', fontSize: '8px' }}>•</span>
                                                                        <span className="text-[9px] font-bold uppercase text-blue-400">
                                                                            {item.percentage.toFixed(2)}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Values */}
                                                            <div className="text-right flex items-center gap-4 flex-shrink-0 ml-2">
                                                                <div>
                                                                    <p
                                                                        className="text-base sm:text-lg font-mono font-black"
                                                                        style={{ color: isBase ? 'var(--accent-orange)' : 'var(--text-primary)' }}
                                                                    >
                                                                        {item.ml.toFixed(2)}
                                                                    </p>
                                                                </div>
                                                                <div className="w-14">
                                                                    <p
                                                                        className="text-xs sm:text-sm font-mono font-bold"
                                                                        style={{ color: 'var(--text-muted)' }}
                                                                    >
                                                                        {item.grams.toFixed(1)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}

                                    {/* ── Totales ── */}
                                    <div className="pt-1 space-y-3">
                                        {/* Totals card */}
                                        <div
                                            className="p-5 rounded-2xl space-y-3"
                                            style={{
                                                backgroundColor: 'var(--bg-ingredient-card)',
                                                border: '1px solid var(--border-ingredient-card)'
                                            }}
                                        >
                                            {/* Top accent line */}
                                            <div
                                                className="h-0.5 w-full rounded-full -mt-1 mb-3"
                                                style={{ background: 'linear-gradient(to right, var(--accent-orange), rgba(184,93,0,0.1))' }}
                                            />
                                            <div className="flex items-center justify-between">
                                                <span
                                                    className="text-[10px] font-bold uppercase tracking-widest"
                                                    style={{ color: 'var(--text-muted)' }}
                                                >
                                                    Total Volumen
                                                </span>
                                                <span
                                                    className="text-xl font-mono font-black"
                                                    style={{ color: 'var(--text-primary)' }}
                                                >
                                                    1000.00
                                                    <span
                                                        className="text-xs font-bold ml-1"
                                                        style={{ color: 'var(--text-muted)' }}
                                                    >
                                                        ml
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span
                                                    className="text-[10px] font-bold uppercase tracking-widest"
                                                    style={{ color: 'var(--text-muted)' }}
                                                >
                                                    Masa Total
                                                </span>
                                                <span
                                                    className="text-lg font-mono font-bold"
                                                    style={{ color: 'var(--text-secondary)' }}
                                                >
                                                    {finalMassSum.toFixed(1)}
                                                    <span
                                                        className="text-xs font-bold ml-1"
                                                        style={{ color: 'var(--text-muted)' }}
                                                    >
                                                        g
                                                    </span>
                                                </span>
                                            </div>
                                            <div
                                                className="h-px w-full"
                                                style={{ backgroundColor: 'var(--border-ingredient-card)' }}
                                            />
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p
                                                        className="text-[9px] font-bold uppercase tracking-widest mb-1"
                                                        style={{ color: 'var(--text-muted)' }}
                                                    >
                                                        Muestras
                                                    </p>
                                                    <p
                                                        className="text-sm font-bold"
                                                        style={{ color: 'var(--text-primary)' }}
                                                    >
                                                        {formula.NOMUESTRAS || '0'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p
                                                        className="text-[9px] font-bold uppercase tracking-widest mb-1"
                                                        style={{ color: 'var(--text-muted)' }}
                                                    >
                                                        Preparación
                                                    </p>
                                                    <p
                                                        className="text-sm font-bold"
                                                        style={{ color: 'var(--text-primary)' }}
                                                    >
                                                        #{formula.VARIANTE || '1'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Producto / Sustrato */}
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { label: 'Producto', value: formula.PRODUCTO },
                                                { label: 'Sustrato', value: formula.SUSTRATO }
                                            ].map(({ label, value }) => (
                                                <div
                                                    key={label}
                                                    className="p-4 rounded-xl"
                                                    style={{
                                                        backgroundColor: 'var(--bg-ingredient-card)',
                                                        border: '1px solid var(--border-ingredient-card)'
                                                    }}
                                                >
                                                    <p
                                                        className="text-[9px] font-bold uppercase tracking-widest mb-1"
                                                        style={{ color: 'var(--text-muted)' }}
                                                    >
                                                        {label}
                                                    </p>
                                                    <p
                                                        className="text-xs font-medium truncate"
                                                        style={{ color: 'var(--text-secondary)' }}
                                                    >
                                                        {value || 'N/A'}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ══ TAB: COLORIMETRÍA ══ */}
                            {activeTab === 'lab' && (
                                <div className="p-4 sm:p-6 space-y-5">

                                    {/* LAB Comparison table */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between px-1 mb-3">
                                            <h4
                                                className="text-[10px] font-bold uppercase tracking-[0.2em]"
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                Comparativa CIELAB
                                            </h4>
                                            <Activity className="h-3.5 w-3.5" style={{ color: 'var(--accent-orange)' }} />
                                        </div>

                                        <div
                                            className="rounded-2xl overflow-hidden"
                                            style={{
                                                backgroundColor: 'var(--bg-ingredient-card)',
                                                border: '1px solid var(--border-ingredient-card)'
                                            }}
                                        >
                                            {/* Table header */}
                                            <div
                                                className="grid grid-cols-3"
                                                style={{ backgroundColor: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-ingredient-card)' }}
                                            >
                                                {['Canal', 'Patrón', 'Fórmula'].map((h, i) => (
                                                    <div
                                                        key={h}
                                                        className="p-3 text-center"
                                                        style={{ borderRight: i < 2 ? '1px solid var(--border-ingredient-card)' : 'none' }}
                                                    >
                                                        <span
                                                            className="text-[9px] font-bold uppercase tracking-widest"
                                                            style={{
                                                                color: i === 1
                                                                    ? 'var(--accent-orange)'
                                                                    : i === 2
                                                                        ? 'var(--accent-color)'
                                                                        : 'var(--text-muted)'
                                                            }}
                                                        >
                                                            {h}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Rows */}
                                            {[
                                                { label: 'L*', p: formula.LO, f: formula.L, color: 'var(--text-primary)' },
                                                { label: 'a*', p: formula.AO, f: formula.A, color: '#34d399' },
                                                { label: 'b*', p: formula.BO, f: formula.B, color: '#fbbf24' },
                                            ].map((row, idx) => (
                                                <div
                                                    key={idx}
                                                    className="grid grid-cols-3"
                                                    style={{ borderBottom: idx < 2 ? '1px solid var(--border-ingredient-card)' : 'none' }}
                                                >
                                                    <div
                                                        className="p-4 text-center"
                                                        style={{
                                                            borderRight: '1px solid var(--border-ingredient-card)',
                                                            backgroundColor: 'var(--bg-table-row-alt)'
                                                        }}
                                                    >
                                                        <span
                                                            className="text-sm font-black"
                                                            style={{ color: 'var(--text-muted)' }}
                                                        >
                                                            {row.label}
                                                        </span>
                                                    </div>
                                                    <div
                                                        className="p-4 text-center"
                                                        style={{ borderRight: '1px solid var(--border-ingredient-card)' }}
                                                    >
                                                        <span className="text-sm font-mono font-bold" style={{ color: row.color }}>
                                                            {parseFloat(row.p || '0').toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="p-4 text-center" style={{ backgroundColor: 'var(--bg-table-row-alt)' }}>
                                                        <span className="text-sm font-mono font-bold" style={{ color: row.color }}>
                                                            {parseFloat(row.f || '0').toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Deltas */}
                                    <div className="space-y-3">
                                        <h4
                                            className="text-[10px] font-bold uppercase tracking-[0.2em] px-1"
                                            style={{ color: 'var(--text-muted)' }}
                                        >
                                            Diferenciales (Δ)
                                        </h4>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { key: 'DELTAL', label: 'ΔL' },
                                                { key: 'DELTAA', label: 'Δa' },
                                                { key: 'DELTAB', label: 'Δb' }
                                            ].map(({ key, label }) => {
                                                const val = parseFloat(formula[key] || '0');
                                                const positive = val >= 0;
                                                return (
                                                    <div
                                                        key={key}
                                                        className="p-4 rounded-xl text-center"
                                                        style={{
                                                            backgroundColor: 'var(--bg-ingredient-card)',
                                                            border: '1px solid var(--border-ingredient-card)'
                                                        }}
                                                    >
                                                        <p
                                                            className="text-[9px] font-bold uppercase tracking-widest mb-2"
                                                            style={{ color: 'var(--text-muted)' }}
                                                        >
                                                            {label}
                                                        </p>
                                                        <p
                                                            className="font-mono text-lg font-black"
                                                            style={{ color: positive ? '#34d399' : '#f87171' }}
                                                        >
                                                            {val.toFixed(2)}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* ΔE Total — hero card */}
                                        <div
                                            className="relative overflow-hidden p-6 rounded-2xl flex flex-col items-center justify-center gap-3"
                                            style={{
                                                background: 'var(--bg-delta-hero)',
                                                border: '1px solid rgba(184,93,0,0.3)',
                                                boxShadow: '0 8px 32px rgba(184,93,0,0.08)'
                                            }}
                                        >
                                            {/* Radial glow */}
                                            <div
                                                className="absolute inset-0"
                                                style={{
                                                    background: 'radial-gradient(circle at 30% 20%, rgba(184,93,0,0.1), transparent 70%)',
                                                    pointerEvents: 'none'
                                                }}
                                            />
                                            {/* Accent top bar */}
                                            <div
                                                className="absolute top-0 left-0 right-0 h-0.5"
                                                style={{ background: 'linear-gradient(to right, var(--accent-orange), transparent)' }}
                                            />

                                            <div
                                                className="relative h-11 w-11 rounded-2xl flex items-center justify-center shadow-lg z-10"
                                                style={{
                                                    backgroundColor: 'var(--accent-orange)',
                                                    boxShadow: '0 4px 16px rgba(184,93,0,0.4)'
                                                }}
                                            >
                                                <span className="font-black text-sm text-white">ΔE</span>
                                            </div>
                                            <p
                                                className="relative text-[10px] font-bold uppercase tracking-[0.3em] z-10"
                                                style={{ color: 'var(--accent-orange)' }}
                                            >
                                                Diferencia Total
                                            </p>
                                            <span
                                                className="relative font-mono text-5xl sm:text-6xl font-black tracking-tighter z-10 drop-shadow-lg"
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {formula.DELTA || '0.00'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ══ TAB: PROCESOS ══ */}
                            {activeTab === 'procesos' && (
                                <div className="p-4 sm:p-6 space-y-4">
                                    {processes.length > 0 ? (
                                        <div className="relative">
                                            {/* Timeline line */}
                                            <div
                                                className="absolute left-5 top-3 bottom-3 w-0.5"
                                                style={{ backgroundColor: 'rgba(184,93,0,0.2)' }}
                                            />
                                            <div className="space-y-4">
                                                {processes.map((proc, idx) => (
                                                    <motion.div
                                                        key={idx}
                                                        initial={{ opacity: 0, x: -12 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: idx * 0.08 }}
                                                        className="relative flex items-start gap-4 pl-10"
                                                    >
                                                        {/* Timeline dot */}
                                                        <div
                                                            className="absolute left-3 top-1.5 h-4 w-4 -translate-x-1/2 rounded-full z-10 flex items-center justify-center"
                                                            style={{
                                                                border: '2px solid var(--accent-orange)',
                                                                backgroundColor: 'var(--bg-app)'
                                                            }}
                                                        >
                                                            <div
                                                                className="h-1.5 w-1.5 rounded-full"
                                                                style={{ backgroundColor: 'var(--accent-orange)' }}
                                                            />
                                                        </div>

                                                        {/* Process card */}
                                                        <div
                                                            className="w-full p-4 rounded-xl transition-all duration-200"
                                                            style={{
                                                                backgroundColor: 'var(--bg-ingredient-card)',
                                                                border: '1px solid var(--border-ingredient-card)'
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span
                                                                    className="h-5 w-5 rounded-lg text-[9px] font-black flex items-center justify-center"
                                                                    style={{
                                                                        backgroundColor: 'rgba(184,93,0,0.2)',
                                                                        color: 'var(--accent-orange)'
                                                                    }}
                                                                >
                                                                    {proc.id}
                                                                </span>
                                                                <span
                                                                    className="text-[10px] font-bold uppercase tracking-widest"
                                                                    style={{ color: 'var(--text-muted)' }}
                                                                >
                                                                    Paso del Proceso
                                                                </span>
                                                            </div>
                                                            <p
                                                                className="text-sm leading-relaxed font-medium"
                                                                style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}
                                                            >
                                                                {proc.text}
                                                            </p>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-20 text-center">
                                            <ClipboardList
                                                className="h-10 w-10 mx-auto mb-3 opacity-20"
                                                style={{ color: 'var(--text-muted)' }}
                                            />
                                            <p
                                                className="text-sm font-medium italic"
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                No hay procesos definidos.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ══ TAB: NOTAS ══ */}
                            {activeTab === 'obs' && (
                                <div className="p-4 sm:p-6">
                                    {formula.OBSERVACIONES ? (
                                        <div
                                            className="p-5 rounded-2xl"
                                            style={{
                                                backgroundColor: 'var(--bg-ingredient-card)',
                                                border: '1px solid var(--border-ingredient-card)'
                                            }}
                                        >
                                            <div className="flex items-center gap-2 mb-4">
                                                <MessageSquare
                                                    className="h-4 w-4"
                                                    style={{ color: 'var(--accent-orange)', opacity: 0.7 }}
                                                />
                                                <span
                                                    className="text-[10px] font-bold uppercase tracking-widest"
                                                    style={{ color: 'var(--text-muted)' }}
                                                >
                                                    Observaciones
                                                </span>
                                            </div>
                                            <p
                                                className="text-sm leading-relaxed whitespace-pre-line font-medium italic"
                                                style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}
                                            >
                                                "{formula.OBSERVACIONES}"
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="py-20 text-center">
                                            <MessageSquare
                                                className="h-10 w-10 mx-auto mb-3 opacity-20"
                                                style={{ color: 'var(--text-muted)' }}
                                            />
                                            <p
                                                className="text-sm font-medium italic"
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                No hay observaciones.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ══ TAB: FICHA TÉCNICA ══ */}
                            {activeTab === 'fichatecnica' && (
                                <div ref={pdfContainerRef} className="flex flex-col items-center p-4" style={{ minHeight: '100%', overflowY: 'auto' }}>
                                    <PdfTabContent
                                        field="FICHATECNICA"
                                        hasPdf={basePdfData.FICHATECNICA}
                                        label="Ficha Técnica"
                                        pdfBlobUrls={pdfBlobUrls}
                                        pdfLoading={pdfLoading}
                                        pdfNumPages={pdfNumPages}
                                        pdfContainerWidth={pdfContainerWidth}
                                        containerRef={pdfContainerRef}
                                        onContainerResize={setPdfContainerWidth}
                                        onPageCount={(f, c) => setPdfNumPages(p => ({ ...p, [f]: c }))}
                                        onLoadError={(f) => setPdfBlobUrls(p => ({ ...p, [f]: null }))}
                                    />
                                </div>
                            )}

                            {/* ══ TAB: FICHA SEGURIDAD ══ */}
                            {activeTab === 'fichaseguridad' && (
                                <div ref={pdfContainerRef} className="flex flex-col items-center p-4" style={{ minHeight: '100%', overflowY: 'auto' }}>
                                    <PdfTabContent
                                        field="FICHASEGURIDAD"
                                        hasPdf={basePdfData.FICHASEGURIDAD}
                                        label="Ficha de Seguridad"
                                        pdfBlobUrls={pdfBlobUrls}
                                        pdfLoading={pdfLoading}
                                        pdfNumPages={pdfNumPages}
                                        pdfContainerWidth={pdfContainerWidth}
                                        containerRef={pdfContainerRef}
                                        onContainerResize={setPdfContainerWidth}
                                        onPageCount={(f, c) => setPdfNumPages(p => ({ ...p, [f]: c }))}
                                        onLoadError={(f) => setPdfBlobUrls(p => ({ ...p, [f]: null }))}
                                    />
                                </div>
                            )}
                        </div>

                        {/* ── Footer CTA ── */}
                        <div
                            className="flex-shrink-0 p-4 sm:p-5"
                            style={{
                                backgroundColor: 'var(--bg-tabs-nav)',
                                borderTop: '1px solid var(--border-card)'
                            }}
                        >
                            <button
                                onClick={onClose}
                                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white transition-all duration-200 active:scale-[0.98] relative overflow-hidden group"
                                style={{
                                    background: 'linear-gradient(135deg, #CC5200 0%, var(--accent-orange) 50%, #CC5200 100%)',
                                    backgroundSize: '200% 100%',
                                    boxShadow: '0 4px 20px rgba(184,93,0,0.3), 0 1px 0 rgba(255,255,255,0.08) inset'
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.backgroundPosition = '100% 0';
                                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 28px rgba(204,82,0,0.45), 0 1px 0 rgba(255,255,255,0.1) inset';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.backgroundPosition = '0% 0';
                                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(184,93,0,0.3), 0 1px 0 rgba(255,255,255,0.08) inset';
                                }}
                            >
                                <span className="relative z-10">Cerrar Detalle</span>
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
