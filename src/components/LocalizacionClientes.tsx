import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Calendar, Filter, Loader2, ChevronRight, Crosshair, RotateCcw, List, MapIcon } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const markerIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

interface Ubicacion {
    id: number;
    idcliente: number;
    clienteNombre: string;
    fecha: string;
    latitud: string;
    longitud: string;
}

interface Cliente {
    CODIGO: number;
    NOMBRE: string;
}

interface LocalizacionClientesProps {
    onClose: () => void;
    userData: any;
}

function FlyToPoint({ point }: { point: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (point) {
            map.flyTo(point, 16, { duration: 1.2 });
        }
    }, [point, map]);
    return null;
}

function FitBounds({ points }: { points: Ubicacion[] }) {
    const map = useMap();
    useEffect(() => {
        if (points.length === 0) return;
        const validPoints = points
            .filter(p => p.latitud && p.longitud)
            .map(p => [parseFloat(p.latitud), parseFloat(p.longitud)] as [number, number]);
        if (validPoints.length === 0) return;
        if (validPoints.length === 1) {
            map.setView(validPoints[0], 15);
        } else {
            map.fitBounds(L.latLngBounds(validPoints), { padding: [40, 40] });
        }
    }, [points, map]);
    return null;
}

export default function LocalizacionClientes({ onClose, userData }: LocalizacionClientesProps) {
    const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroCliente, setFiltroCliente] = useState<string>('all');
    const [busquedaCliente, setBusquedaCliente] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedPoint, setSelectedPoint] = useState<[number, number] | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [showSidebar, setShowSidebar] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [fechaInicio, setFechaInicio] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [fechaFin, setFechaFin] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });

    const isAdmin = userData?.typeuser == 0 || userData?.typeuser === '0';

    useEffect(() => {
        if (isAdmin) fetchClientes();
        else if (userData?.idcliente) setFiltroCliente(userData.idcliente.toString());
    }, []);

    useEffect(() => {
        fetchUbicaciones();
    }, [filtroCliente, fechaInicio, fechaFin]);

    const fetchClientes = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/clientes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setClientes(await res.json());
        } catch (error) {
            console.error('Error fetching clientes:', error);
        }
    };

    const fetchUbicaciones = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (filtroCliente !== 'all') params.append('idcliente', filtroCliente);
            if (fechaInicio) params.append('fechaInicio', fechaInicio);
            if (fechaFin) params.append('fechaFin', fechaFin);
            const res = await fetch(`${API_BASE_URL}/api/ubicaciones?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setUbicaciones(await res.json());
        } catch (error) {
            console.error('Error fetching ubicaciones:', error);
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => {
        setFiltroCliente('all');
        setBusquedaCliente('');
        const now = new Date();
        setFechaInicio(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
        setFechaFin(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
    };

    const formatFecha = (fecha: string) => {
        return new Date(fecha).toLocaleDateString('es-ES', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const formatFechaCorta = (fecha: string) => {
        return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const defaultCenter: [number, number] = [-0.180653, -78.467834];

    const clientesFiltrados = clientes.filter(c =>
        (c.NOMBRE || '').toLowerCase().includes(busquedaCliente.toLowerCase())
    );

    const selectedClientName = clientes.find(c => c.CODIGO.toString() === filtroCliente)?.NOMBRE || '';

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectCliente = (codigo: string, nombre: string) => {
        setFiltroCliente(codigo);
        setBusquedaCliente(codigo === 'all' ? '' : nombre);
        setShowDropdown(false);
    };

    return (
        <div className="fixed inset-0 z-[300] flex flex-col w-full" style={{ background: 'var(--bg-app)' }}>
            {/* ── Header (naranja corporativo) ── */}
            <header className="flex-shrink-0 flex w-full items-center justify-between border-b border-black/10 shadow-lg px-6 py-4" style={{ background: 'var(--accent-orange)' }}>
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-transparent overflow-hidden rounded flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight text-white uppercase leading-none">Ubicación de Clientes</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <p className="text-[10px] text-white/70"><span className="text-white/90 uppercase tracking-wider">Mapa de accesos</span></p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Contador de puntos */}
                    <div className="hidden sm:flex items-center gap-2 bg-black/15 rounded-lg px-3 py-1.5">
                        <MapPin className="h-3.5 w-3.5 text-white/80" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                            {ubicaciones.length} punto{ubicaciones.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    {/* Toggle sidebar */}
                    <button
                        onClick={() => setShowSidebar(!showSidebar)}
                        className="p-2 text-black hover:text-white transition-colors bg-black/10 rounded-lg"
                        title={showSidebar ? 'Ocultar lista' : 'Mostrar lista'}
                    >
                        {showSidebar ? <List className="h-5 w-5 text-white" /> : <MapIcon className="h-5 w-5 text-white" />}
                    </button>
                    {/* Cerrar */}
                    <button
                        onClick={onClose}
                        className="p-2 text-black hover:text-white transition-colors bg-black/10 rounded-lg"
                        title="Cerrar"
                    >
                        <X className="h-5 w-5 text-white" />
                    </button>
                </div>
            </header>

            {/* ── Filtros ── */}
            <div className="flex-shrink-0 border-b w-full px-6 py-3 flex flex-wrap items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}>
                {isAdmin && (
                    <div className="relative flex w-full items-center gap-2" ref={dropdownRef}>
                        <Filter className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        <div className="relative w-full">
                            <input
                                type="text"
                                value={showDropdown ? busquedaCliente : (selectedClientName || busquedaCliente)}
                                onChange={(e) => {
                                    setBusquedaCliente(e.target.value);
                                    setFiltroCliente('all');
                                    setShowDropdown(true);
                                }}
                                onFocus={() => {
                                    setBusquedaCliente(filtroCliente === 'all' ? '' : selectedClientName);
                                    setShowDropdown(true);
                                }}
                                placeholder="Buscar cliente..."
                                className="rounded-xl w-full pl-4 pr-8 py-2 text-xs outline-none transition-all font-medium w-52"
                                style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-card)' }}
                            />
                            {filtroCliente !== 'all' && (
                                <button
                                    onClick={() => {
                                        setFiltroCliente('all');
                                        setBusquedaCliente('');
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                        {showDropdown && (
                            <div
                                className="absolute top-full left-6 mt-1 w-full max-h-52 overflow-y-auto rounded-xl shadow-2xl z-[600]"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}
                            >
                                <button
                                    onClick={() => selectCliente('all', '')}
                                    className="w-full text-left px-4 py-2.5 text-xs font-medium transition-colors border-b"
                                    style={{
                                        color: filtroCliente === 'all' ? 'var(--accent-orange)' : 'var(--text-secondary)',
                                        background: filtroCliente === 'all' ? 'rgba(217,119,6,0.08)' : 'transparent',
                                        borderColor: 'var(--border-card)'
                                    }}
                                >
                                    Todos los clientes
                                </button>
                                {clientesFiltrados.length === 0 ? (
                                    <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: 'var(--text-muted)' }}>
                                        Sin resultados
                                    </div>
                                ) : (
                                    clientesFiltrados.map(c => (
                                        <button
                                            key={c.CODIGO}
                                            onClick={() => selectCliente(c.CODIGO.toString(), c.NOMBRE)}
                                            className="w-full text-left px-4 py-2.5 text-xs font-medium transition-colors"
                                            style={{
                                                color: filtroCliente === c.CODIGO.toString() ? 'var(--accent-orange)' : 'var(--text-secondary)',
                                                background: filtroCliente === c.CODIGO.toString() ? 'rgba(217,119,6,0.08)' : 'transparent'
                                            }}
                                        >
                                            {c.NOMBRE}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="date"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        className="rounded-xl px-3 py-2 text-xs outline-none transition-all font-medium flex-1 min-w-0"
                        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-card)' }}
                    />
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: 'var(--text-muted)' }}>→</span>
                    <input
                        type="date"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        className="rounded-xl px-3 py-2 text-xs outline-none transition-all font-medium flex-1 min-w-0"
                        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-card)' }}
                    />
                </div>
                <button
                    onClick={clearFilters}
                    className="relative flex items-center justify-center p-2 rounded-xl transition-all active:scale-95 flex-shrink-0"
                    style={{ background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.2)' }}
                    title="Reiniciar filtros"
                >
                    <RotateCcw className="h-4 w-4" />
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[8px] font-black text-white px-1" style={{ background: 'var(--accent-orange)' }}>
                        {ubicaciones.length}
                    </span>
                </button>
            </div>

            {/* ── Contenido principal: Sidebar + Mapa ── */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* ── Sidebar Lista ── */}
                <AnimatePresence>
                    {showSidebar && (
                        <motion.aside
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 238, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="flex-shrink-0 border-r overflow-hidden flex flex-col"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}
                        >
                            <div className="p-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-card)' }}>
                                <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                    Registro de accesos
                                </h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card-hover)' }} />
                                    ))
                                ) : ubicaciones.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center px-6">
                                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.2)' }}>
                                            <MapPin className="h-8 w-8" style={{ color: 'var(--accent-orange)' }} />
                                        </div>
                                        <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Sin resultados</p>
                                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Ajusta los filtros para ver ubicaciones</p>
                                    </div>
                                ) : (
                                    ubicaciones.map((ubi, idx) => {
                                        const lat = parseFloat(ubi.latitud);
                                        const lng = parseFloat(ubi.longitud);
                                        if (isNaN(lat) || isNaN(lng)) return null;
                                        const isSelected = selectedId === ubi.id;
                                        return (
                                            <motion.button
                                                key={ubi.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.02 }}
                                                onClick={() => {
                                                    setSelectedPoint([lat, lng]);
                                                    setSelectedId(ubi.id);
                                                }}
                                                className="w-full text-left p-4 rounded-2xl border transition-all"
                                                style={{
                                                    background: isSelected ? 'rgba(217,119,6,0.08)' : 'transparent',
                                                    borderColor: isSelected ? 'rgba(217,119,6,0.35)' : 'var(--border-card)',
                                                    boxShadow: isSelected ? '0 4px 20px rgba(217,119,6,0.08)' : 'none'
                                                }}
                                            >
                                                <div className="flex items-start justify-between mb-1.5">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: isSelected ? 'rgba(217,119,6,0.15)' : 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
                                                            <MapPin className="h-3.5 w-3.5" style={{ color: 'var(--accent-orange)' }} />
                                                        </div>
                                                        <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{ubi.clienteNombre}</span>
                                                    </div>
                                                    <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 transition-transform" style={{ color: isSelected ? 'var(--accent-orange)' : 'var(--text-muted)', transform: isSelected ? 'translateX(2px)' : 'none' }} />
                                                </div>
                                                <p className="text-[10px] font-medium ml-9" style={{ color: 'var(--text-muted)' }}>{formatFechaCorta(ubi.fecha)}</p>
                                                <p className="text-[9px] font-mono ml-9 mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{lat.toFixed(4)}, {lng.toFixed(4)}</p>
                                            </motion.button>
                                        );
                                    })
                                )}
                            </div>
                        </motion.aside>
                    )}
                </AnimatePresence>

                {/* ── Mapa ── */}
                <div className="flex-1 relative min-h-0">
                    {loading && (
                        <div className="absolute inset-0 z-[500] flex items-center justify-center" style={{ background: 'rgba(5,8,12,0.85)', backdropFilter: 'blur(8px)' }}>
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-12 h-12 rounded-full border-[3px] animate-spin" style={{ borderColor: 'rgba(217,119,6,0.2)', borderTopColor: 'var(--accent-orange)' }} />
                                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Cargando ubicaciones...</p>
                            </div>
                        </div>
                    )}
                    <MapContainer
                        center={defaultCenter}
                        zoom={12}
                        style={{ height: '100%', width: '100%' }}
                        className="z-0"
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        />
                        <FitBounds points={ubicaciones} />
                        <FlyToPoint point={selectedPoint} />
                        {ubicaciones.map((ubi) => {
                            const lat = parseFloat(ubi.latitud);
                            const lng = parseFloat(ubi.longitud);
                            if (isNaN(lat) || isNaN(lng)) return null;
                            return (
                                <Marker key={ubi.id} position={[lat, lng]} icon={markerIcon}>
                                    <Popup className="custom-popup">
                                        <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 180 }}>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 4 }}>{ubi.clienteNombre}</div>
                                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{formatFecha(ubi.fecha)}</div>
                                            <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{lat.toFixed(6)}, {lng.toFixed(6)}</div>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MapContainer>

                    {/* Estado vacío */}
                    {!loading && ubicaciones.length === 0 && (
                        <div className="absolute inset-0 z-[400] flex items-center justify-center pointer-events-none">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="pointer-events-auto text-center p-8 rounded-3xl shadow-2xl"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}
                            >
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.2)' }}>
                                    <MapPin className="h-8 w-8" style={{ color: 'var(--accent-orange)' }} />
                                </div>
                                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>No hay ubicaciones</p>
                                <p className="text-[10px] mt-1 max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
                                    No se encontraron accesos en el rango seleccionado
                                </p>
                                <button
                                    onClick={clearFilters}
                                    className="mt-4 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95"
                                    style={{ background: 'var(--accent-orange)', color: '#fff' }}
                                >
                                    Restablecer filtros
                                </button>
                            </motion.div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Popup Leaflet override (dark theme) ── */}
            <style>{`
                .custom-popup .leaflet-popup-content-wrapper {
                    background: var(--bg-card, #0d141e) !important;
                    color: var(--text-primary, #f8fafc) !important;
                    border: 1px solid var(--border-card, rgba(38,55,77,0.45)) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 12px 30px -10px rgba(0,0,0,0.8) !important;
                    padding: 0 !important;
                }
                .custom-popup .leaflet-popup-content {
                    margin: 12px 14px !important;
                    color: var(--text-primary, #f8fafc) !important;
                }
                .custom-popup .leaflet-popup-tip {
                    background: var(--bg-card, #0d141e) !important;
                    border: 1px solid var(--border-card, rgba(38,55,77,0.45)) !important;
                    border-top: none !important;
                    border-left: none !important;
                }
                .custom-popup .leaflet-popup-close-button {
                    color: var(--text-muted, #94a3b8) !important;
                    font-size: 18px !important;
                    padding: 6px 8px 0 0 !important;
                }
                .custom-popup .leaflet-popup-close-button:hover {
                    color: var(--accent-orange, #d97706) !important;
                }
                .leaflet-container { font-family: Inter, sans-serif !important; }
            `}</style>
        </div>
    );
}
