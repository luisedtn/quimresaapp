import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, User, Camera as CameraIcon, UploadCloud, Save, Building2, MapPin, Phone, Crosshair } from 'lucide-react';
import { API_BASE_URL } from '../config';

import Sidebar from '../components/Sidebar';
import { Country, State, City } from 'country-state-city';
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Cliente {
    NOMBRE: string;
    NIF: string;
    PAIS: string;
    PROVINCIA: string;
    POBLACION: string;
    DIRECCION: string;
    TELEFONO: string;
    MOVIL: string;
    CONTACTO: string;
    LOGO: string;
    LATITUD?: string;
    LONGITUD?: string;
}

function LocationMarker({ position, setPosition }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void }) {
    const map = useMapEvents({
        click(e) {
            setPosition(e.latlng);
            map.flyTo(e.latlng, map.getZoom());
        },
    });

    return position === null ? null : (
        <Marker
            position={position}
            draggable={true}
            eventHandlers={{
                dragend: (e) => {
                    const marker = e.target;
                    setPosition(marker.getLatLng());
                    map.flyTo(marker.getLatLng(), map.getZoom());
                }
            }}
        />
    );
}

function LocateControl({ setPosition }: { setPosition: (pos: L.LatLng) => void }) {
    const map = useMap();
    const [locating, setLocating] = useState(false);

    const handleLocate = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLocating(true);
        try {
            const coordinates = await Geolocation.getCurrentPosition();
            const newPos = L.latLng(coordinates.coords.latitude, coordinates.coords.longitude);
            setPosition(newPos);
            map.flyTo(newPos, 16);
        } catch (error) {
            console.error('Error getting location', error);
            alert('Asegúrate de conceder permisos de ubicación.');
        } finally {
            setLocating(false);
        }
    };

    return (
        <div className="absolute top-3 right-3 z-[400]">
            <button
                type="button"
                onClick={handleLocate}
                disabled={locating}
                className="bg-white px-3 py-2 text-slate-800 text-xs font-bold uppercase rounded-lg shadow-xl hover:bg-slate-100 flex items-center justify-center gap-2 border border-slate-200 transition-colors disabled:opacity-75"
                title="Mi ubicación actual"
            >
                {locating ? 'Buscando...' : <><Crosshair className="w-4 h-4 text-blue-500" /> Mi Ubicación</>}
            </button>
        </div>
    );
}

export default function Cuenta({ userData, onLogout }: { userData: any; onLogout: () => void }) {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [formData, setFormData] = useState<Cliente>({
        NOMBRE: '', NIF: '', PAIS: '', PROVINCIA: '', POBLACION: '',
        DIRECCION: '', TELEFONO: '', MOVIL: '', CONTACTO: '', LOGO: '',
        LATITUD: '', LONGITUD: ''
    });

    const [countries, setCountries] = useState<any[]>([]);
    const [states, setStates] = useState<any[]>([]);
    const [cities, setCities] = useState<any[]>([]);

    // Selected ISO codes to query next level
    const [selectedCountryCode, setSelectedCountryCode] = useState('');
    const [selectedStateCode, setSelectedStateCode] = useState('');

    useEffect(() => {
        setCountries(Country.getAllCountries());
        const fetchCliente = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE_URL}/api/cliente`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setFormData({
                        NOMBRE: data.NOMBRE || '', NIF: data.NIF || '', PAIS: data.PAIS || '',
                        PROVINCIA: data.PROVINCIA || '', POBLACION: data.POBLACION || '',
                        DIRECCION: data.DIRECCION || '', TELEFONO: data.TELEFONO || '',
                        MOVIL: data.MOVIL || '', CONTACTO: data.CONTACTO || '', LOGO: data.LOGO || '',
                        LATITUD: data.LATITUD || '', LONGITUD: data.LONGITUD || ''
                    });

                    // Preload states if country was saved
                    if (data.PAIS) {
                        const c = Country.getAllCountries().find(x => x.name === data.PAIS);
                        if (c) {
                            setSelectedCountryCode(c.isoCode);
                            setStates(State.getStatesOfCountry(c.isoCode));
                            // Preload cities if state was saved
                            if (data.PROVINCIA) {
                                const s = State.getStatesOfCountry(c.isoCode).find(x => x.name === data.PROVINCIA);
                                if (s) {
                                    setSelectedStateCode(s.isoCode);
                                    setCities(City.getCitiesOfState(c.isoCode, s.isoCode));
                                }
                            }
                        }
                    }
                } else if (res.status === 401 || res.status === 403) {
                    onLogout();
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchCliente();
    }, []);

    const handleCountryChange = (val: string) => {
        const country = countries.find(c => c.name === val);
        setFormData({ ...formData, PAIS: val, PROVINCIA: '', POBLACION: '' });
        if (country) {
            setSelectedCountryCode(country.isoCode);
            setStates(State.getStatesOfCountry(country.isoCode));
            setCities([]);
        } else {
            setSelectedCountryCode('');
            setStates([]);
            setCities([]);
        }
    };

    const handleStateChange = (val: string) => {
        const state = states.find(s => s.name === val);
        setFormData({ ...formData, PROVINCIA: val, POBLACION: '' });
        if (state && selectedCountryCode) {
            setSelectedStateCode(state.isoCode);
            setCities(City.getCitiesOfState(selectedCountryCode, state.isoCode));
        } else {
            setSelectedStateCode('');
            setCities([]);
        }
    };

    const handleLogoUpload = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 80,
                allowEditing: true,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Prompt,
                promptLabelHeader: 'Foto del Logo',
                promptLabelCancel: 'Cancelar',
                promptLabelPhoto: 'Elegir de la Galería',
                promptLabelPicture: 'Tomar Foto'
            });

            if (image.dataUrl) {
                // Check aproximate size to avoid big payloads > 5MB
                if (image.dataUrl.length > 5 * 1024 * 1024 * 1.37) {
                    setMessage({ type: 'error', text: 'La imagen es muy pesada. Máximo ~5MB' });
                    return;
                }
                setFormData({ ...formData, LOGO: image.dataUrl });
            }
        } catch (error) {
            console.log('User cancelled camera/gallery or an error occurred:', error);
        }
    };

    const validatePhones = () => {
        const iso = (selectedCountryCode as CountryCode) || 'EC'; // Ecuador por defecto

        if (formData.TELEFONO && formData.TELEFONO.trim() !== '') {
            const tel = parsePhoneNumberFromString(formData.TELEFONO, iso);
            if (!tel || !tel.isValid()) return { field: 'TELEFONO', msg: 'El Teléfono Fijo ingresado no es válido (Incluya su prefijo o revise su país).' };
            if (tel.getType() === 'MOBILE') return { field: 'TELEFONO', msg: 'El campo Teléfono Fijo detectó un Celular. Por favor use solo fijos aquí.' };
        }

        if (formData.MOVIL && formData.MOVIL.trim() !== '') {
            const mobile = parsePhoneNumberFromString(formData.MOVIL, iso);
            if (!mobile || !mobile.isValid()) return { field: 'MOVIL', msg: 'El Celular / Móvil ingresado no es un número válido.' };
            const t = mobile.getType();
            if (t === 'FIXED_LINE') return { field: 'MOVIL', msg: 'El campo Móvil detectó un número Fijo. Use únicamente celulares.' };
        }

        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        const phoneErr = validatePhones();
        if (phoneErr) {
            setMessage({ type: 'error', text: phoneErr.msg });
            const errorElement = document.getElementById(phoneErr.field);
            if (errorElement) {
                errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                errorElement.focus();
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/cliente`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) onLogout();
                throw new Error('Error al actualizar registro');
            }
            setMessage({ type: 'success', text: '¡Datos de la empresa actualizados correctamente!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const mapPosition = formData.LATITUD && formData.LONGITUD
        ? L.latLng(parseFloat(formData.LATITUD), parseFloat(formData.LONGITUD))
        : L.latLng(-0.180653, -78.467834); // Default to Quito, Ecuador if missing.

    const updatePosition = (pos: L.LatLng) => {
        setFormData(prev => ({
            ...prev,
            LATITUD: pos.lat.toString(),
            LONGITUD: pos.lng.toString()
        }));
    };

    return (
        <div className="min-h-screen bg-[#0A0F14] text-slate-200 font-sans flex flex-col">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onLogout={onLogout} userData={userData} />

            {/* Header */}
            <header className="fixed top-0 z-10 flex w-full items-center border-b border-slate-800 bg-[#0A0F14]/80 backdrop-blur-md px-6 py-4">
                <button onClick={() => navigate('/')} className="p-2 text-slate-400 hover:text-white transition-colors hover:bg-slate-800/50 rounded-lg mr-2">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                        <User className="h-5 w-5 text-blue-400" /> Mi Cuenta
                    </h1>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Configuración y datos de empresa</p>
                </div>
            </header>

            <main className="pt-24 pb-12 px-6 flex-grow container mx-auto max-w-4xl">
                {message.text && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`p-4 rounded-lg mb-6 text-sm font-semibold ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                        {message.text}
                    </motion.div>
                )}

                {loading ? (
                    <div className="flex justify-center mt-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>
                ) : (
                    <motion.form
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        onSubmit={handleSubmit}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl relative"
                    >
                        <div className="flex flex-col md:flex-row gap-8">

                            {/* Left Side: Logo */}
                            <div className="flex flex-col items-center gap-4 w-full md:w-1/3">
                                <div className="w-full aspect-square bg-slate-800 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center p-4 relative group overflow-hidden">
                                    {formData.LOGO ? (
                                        <img src={formData.LOGO} alt="Logo" className="w-full h-full object-contain" />
                                    ) : (
                                        <div className="text-slate-500 flex flex-col items-center gap-2">
                                            <Building2 className="w-12 h-12 opacity-50" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Sin Logo</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button type="button" onClick={handleLogoUpload} className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full transition-colors flex items-center gap-2">
                                            <CameraIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-500 text-center uppercase">Click para cambiar Logo<br />ó usar la cámara del teléfono</p>
                            </div>

                            {/* Right Side: Form */}
                            <div className="w-full space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Nombre Comercial</label>
                                        <input type="text" value={formData.NOMBRE} onChange={e => setFormData({ ...formData, NOMBRE: e.target.value })} required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">RUC</label>
                                        <input type="text" value={formData.NIF} onChange={e => setFormData({ ...formData, NIF: e.target.value })} required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none" />
                                    </div>
                                </div>

                                <h3 className="text-xs font-bold text-blue-400 flex items-center gap-2 border-b border-slate-800 pb-2 pt-2 uppercase tracking-wide">
                                    <MapPin className="w-4 h-4" /> Ubicación
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">País</label>
                                        <input list="countries-list" value={formData.PAIS} onChange={(e) => handleCountryChange(e.target.value)} placeholder="Busca o selecciona..." className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none" />
                                        <datalist id="countries-list">
                                            {countries.map(c => <option key={c.isoCode} value={c.name} />)}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Provincia/Estado</label>
                                        <input list="states-list" value={formData.PROVINCIA} onChange={(e) => handleStateChange(e.target.value)} disabled={!formData.PAIS} placeholder={!formData.PAIS ? "Elige País Primero" : "Elige..."} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none disabled:opacity-50" />
                                        <datalist id="states-list">
                                            {states.map(s => <option key={s.isoCode} value={s.name} />)}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Ciudad/Población</label>
                                        <input list="cities-list" value={formData.POBLACION} onChange={e => setFormData({ ...formData, POBLACION: e.target.value })} disabled={!formData.PROVINCIA} placeholder={!formData.PROVINCIA ? "Elige Provincia..." : "Elige..."} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none disabled:opacity-50" />
                                        <datalist id="cities-list">
                                            {cities.map(cty => <option key={cty.name} value={cty.name} />)}
                                        </datalist>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Dirección Exacta</label>
                                    <input type="text" value={formData.DIRECCION} onChange={e => setFormData({ ...formData, DIRECCION: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none" />
                                </div>

                                <div className="mt-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-2">Mapa (Arrastra el pin o usa tu ubicación actual)</label>
                                    <div className="h-64 sm:h-80 w-full rounded-xl overflow-hidden border border-slate-700 relative z-0">
                                        <MapContainer center={mapPosition} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                                            <TileLayer
                                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                            />
                                            <LocationMarker position={formData.LATITUD && formData.LONGITUD ? mapPosition : null} setPosition={updatePosition} />
                                            <LocateControl setPosition={updatePosition} />
                                        </MapContainer>
                                    </div>
                                    <div className="flex gap-4 mt-2 mb-4">
                                        <div className="flex-1 hidden">
                                            <input type="text" value={formData.LATITUD || ''} readOnly placeholder="Latitud" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-xs text-slate-400 outline-none" />
                                        </div>
                                        <div className="flex-1 hidden">
                                            <input type="text" value={formData.LONGITUD || ''} readOnly placeholder="Longitud" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-xs text-slate-400 outline-none" />
                                        </div>
                                    </div>
                                </div>

                                <h3 className="text-xs font-bold text-blue-400 flex items-center gap-2 border-b border-slate-800 pb-2 pt-2 uppercase tracking-wide">
                                    <Phone className="w-4 h-4" /> Contacto
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Teléfono Fijo</label>
                                        <input id="TELEFONO" type="tel" value={formData.TELEFONO} onChange={e => setFormData({ ...formData, TELEFONO: e.target.value })} placeholder="Ej. +34 91..." className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Móvil (Celular)</label>
                                        <input id="MOVIL" type="tel" value={formData.MOVIL} onChange={e => setFormData({ ...formData, MOVIL: e.target.value })} placeholder="Ej. +34 6..." className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Encargado de cuenta</label>
                                        <input type="text" value={formData.CONTACTO} onChange={e => setFormData({ ...formData, CONTACTO: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none" />
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-800">
                                    <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 w-full md:w-auto ml-auto px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold uppercase tracking-widest text-sm transition-all shadow-lg shadow-blue-900/20 disabled:bg-slate-700">
                                        {saving ? 'Guardando...' : <><Save className="w-5 h-5" /> Guardar Cambios</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.form>
                )}
            </main>
        </div>
    );
}
