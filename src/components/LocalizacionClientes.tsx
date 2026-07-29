import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X, MapPin, Calendar, Filter, Loader2 } from 'lucide-react';
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

const orangeIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: 'leaflet-marker-orange',
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
            const bounds = L.latLngBounds(validPoints);
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    }, [points, map]);

    return null;
}

export default function LocalizacionClientes({ onClose, userData }: LocalizacionClientesProps) {
    const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroCliente, setFiltroCliente] = useState<string>('all');
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
        if (isAdmin) {
            fetchClientes();
        } else if (userData?.idcliente) {
            setFiltroCliente(userData.idcliente.toString());
        }
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
            if (res.ok) {
                const data = await res.json();
                setClientes(data);
            }
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
            if (res.ok) {
                const data = await res.json();
                setUbicaciones(data);
            }
        } catch (error) {
            console.error('Error fetching ubicaciones:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatFecha = (fecha: string) => {
        const d = new Date(fecha);
        return d.toLocaleDateString('es-ES', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const defaultCenter: [number, number] = [-0.180653, -78.467834];

    return (
        <div className="fixed inset-0 z-[300] flex flex-col bg-[#0A0F14]/98 backdrop-blur-xl w-full">
            {/* Header */}
            <div className="flex-shrink-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-emerald-600/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                        <MapPin className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-tight">Ubicación de Clientes</h2>
                        <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Mapa de accesos registrados</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-4 border border-slate-800 bg-slate-800/50 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-95"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Filters */}
            <div className="flex-shrink-0 bg-slate-900/50 border-b border-slate-800/50 px-6 py-3 flex flex-wrap items-center gap-4">
                {isAdmin && (
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-500" />
                        <select
                            value={filtroCliente}
                            onChange={(e) => setFiltroCliente(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-emerald-500/50 transition-all font-medium cursor-pointer"
                        >
                            <option value="all">Todos los clientes</option>
                            {clientes.map(c => (
                                <option key={c.CODIGO} value={c.CODIGO}>{c.NOMBRE}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <input
                        type="date"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-emerald-500/50 transition-all font-medium"
                    />
                    <span className="text-slate-600 text-xs font-bold">→</span>
                    <input
                        type="date"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-emerald-500/50 transition-all font-medium"
                    />
                </div>
                <div className="ml-auto text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                    {ubicaciones.length} punto{ubicaciones.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* Map */}
            <div className="flex-1 relative min-h-0">
                {loading && (
                    <div className="absolute inset-0 z-[500] flex items-center justify-center bg-[#0A0F14]/80 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="h-10 w-10 text-emerald-400 animate-spin" />
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Cargando ubicaciones...</p>
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
                    {ubicaciones.map((ubi) => {
                        const lat = parseFloat(ubi.latitud);
                        const lng = parseFloat(ubi.longitud);
                        if (isNaN(lat) || isNaN(lng)) return null;
                        return (
                            <Marker key={ubi.id} position={[lat, lng]} icon={orangeIcon}>
                                <Popup>
                                    <div className="text-sm font-semibold text-slate-800">{ubi.clienteNombre}</div>
                                    <div className="text-xs text-slate-500 mt-1">{formatFecha(ubi.fecha)}</div>
                                    <div className="text-[10px] text-slate-400 mt-1">
                                        {lat.toFixed(6)}, {lng.toFixed(6)}
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                </MapContainer>

                {!loading && ubicaciones.length === 0 && (
                    <div className="absolute inset-0 z-[400] flex items-center justify-center pointer-events-none">
                        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl pointer-events-auto">
                            <MapPin className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                            <p className="text-sm text-slate-400 font-bold">No hay ubicaciones registradas</p>
                            <p className="text-[10px] text-slate-600 mt-1">Ajusta los filtros o verifica el rango de fechas</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
