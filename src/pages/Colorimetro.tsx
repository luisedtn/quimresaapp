import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    ArrowLeft, Bluetooth, BluetoothSearching, BluetoothConnected, BluetoothOff,
    Scan, Battery, AlertTriangle, Trash2, Palette, Settings
} from 'lucide-react';
import DeviceSettings from '../components/DeviceSettings';
import { API_BASE_URL } from '../config';

import Sidebar from '../components/Sidebar';
import { useNixDevice } from '../hooks/useNixDevice';
import { NixBluetoothService, deltaE2000, NixMeasurement } from '../services/NixBluetoothService';

const STORAGE_KEY = 'colorimetro_data';

interface PersistedData {
    lastMeasurement: NixMeasurement | null;
    measurements: NixMeasurement[];
}

function loadPersistedData(): PersistedData {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { }
    return { lastMeasurement: null, measurements: [] };
}

function savePersistedData(data: PersistedData): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { }
}

export default function Colorimetro({ userData, onLogout }: { userData: any; onLogout: () => void }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isDeviceSettingsOpen, setIsDeviceSettingsOpen] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });
    const [isReturning, setIsReturning] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<string | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const [persistedData, setPersistedData] = useState<PersistedData>(loadPersistedData);
    const isFirstMount = useRef(true);

    const returnTo = location.state?.returnTo;
    const autoScan = location.state?.autoScan;

    const formatDecimals = (val: any) => {
        const num = Number(val);
        return isNaN(num) ? val : num.toFixed(2);
    };

    const {
        isSupported,
        isScanning,
        isConnecting,
        isConnected,
        isMeasuring,
        deviceInfo,
        lastMeasurement,
        measurements,
        error,
        status,
        scan,
        cancelScan,
        disconnect,
        measure,
        removeMeasurement,
        clearMeasurements,
        clearError,
        settings,
        reloadSettings,
    } = useNixDevice();

    // Auto-scan on mount if coming from Scan with autoScan flag
    useEffect(() => {
        if (autoScan && !isConnected && isSupported) {
            scan();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-return logic when connected if we came from Scan
    useEffect(() => {
        if (isConnected && returnTo) {
            setIsReturning(true);
            const timer = setTimeout(() => {
                navigate(returnTo, { state: location.state });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isConnected, returnTo, navigate]);

    // Persist measurements to localStorage on every change (skip initial mount)
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        savePersistedData({ lastMeasurement, measurements });
        setPersistedData({ lastMeasurement, measurements });
    }, [lastMeasurement, measurements]);

    // Only show persisted data when coming from Dashboard (no returnTo) and device is connected
    const canRestore = isConnected && !returnTo;
    const displayLastMeasurement = lastMeasurement ?? (canRestore ? persistedData.lastMeasurement : null);
    const displayMeasurements = measurements.length > 0 ? measurements : (canRestore ? persistedData.measurements : []);

    const handleSaveMeasurement = async (m: NixMeasurement) => {
        setSavingId(m.timestamp);
        try {
            const token = localStorage.getItem('token');
            const c = m.color;
            const res = await fetch(`${API_BASE_URL}/api/mediciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    nombre: `Color ${c.hex.toUpperCase()}`,
                    fecha: m.timestamp,
                    L: c.L, A: c.a, B: c.b,
                    R: c.R, G: c.G, RB: c.B,
                    C: c.C, H: c.H,
                    X: c.X, Y: c.Y, Z: c.Z,
                    hex: c.hex,
                    LRV: c.LRV, Density: c.Density,
                    cmykC: c.cmyk?.C, cmykM: c.cmyk?.M, cmykY: c.cmyk?.Y, cmykK: c.cmyk?.K,
                    blanco_referencia: settings.referenceWhite,
                    modo_medicion: settings.measurementMode,
                    densidad: settings.densityStatus,
                    promedio: settings.multiPointAveraging,
                }),
            });
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) onLogout();
                throw new Error('Error al guardar');
            }
            setSaveMessage({ type: 'success', text: '¡Medición guardada correctamente!' });
        } catch (err: any) {
            setSaveMessage({ type: 'error', text: err.message });
        } finally {
            setSavingId(null);
            setTimeout(() => setSaveMessage({ type: '', text: '' }), 3000);
        }
    };

    const averages = useMemo(() => {
        if (displayMeasurements.length === 0) return null;
        const sum = { L: 0, a: 0, b: 0, R: 0, G: 0, B: 0, C: 0, H: 0, X: 0, Y: 0, Z: 0, cmykC: 0, cmykM: 0, cmykY: 0, cmykK: 0, LRV: 0 };
        const hexToRgb = (hex: string) => {
            const h = hex.replace('#', '');
            const m = h.match(/^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
            return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
        };
        displayMeasurements.forEach(m => {
            sum.L += m.color.L;
            sum.a += m.color.a;
            sum.b += m.color.b;
            const rgb = hexToRgb(m.color.hex);
            if (rgb) {
                sum.R += rgb.r;
                sum.G += rgb.g;
                sum.B += rgb.b;
            } else {
                sum.R += m.color.R || 0;
                sum.G += m.color.G || 0;
                sum.B += m.color.B || 0;
            }
            sum.C += m.color.C;
            sum.H += m.color.H;

            sum.X += m.color.X || 0;
            sum.Y += m.color.Y || 0;
            sum.Z += m.color.Z || 0;
            sum.cmykC += m.color.cmyk?.C || 0;
            sum.cmykM += m.color.cmyk?.M || 0;
            sum.cmykY += m.color.cmyk?.Y || 0;
            sum.cmykK += m.color.cmyk?.K || 0;
            sum.LRV += m.color.LRV || 0;
        });
        const n = displayMeasurements.length;
        const avgL = sum.L / n;
        const avgA = sum.a / n;
        const avgB = sum.b / n;
        const avgR = Math.round(sum.R / n);
        const avgG = Math.round(sum.G / n);
        const avgBval = Math.round(sum.B / n);
        const avgC = sum.C / n;
        const avgH = sum.H / n;
        const avgX = sum.X / n;
        const avgY = sum.Y / n;
        const avgZ = sum.Z / n;
        const cmyk = {
            C: Math.round(sum.cmykC / n),
            M: Math.round(sum.cmykM / n),
            Y: Math.round(sum.cmykY / n),
            K: Math.round(sum.cmykK / n)
        };
        const LRV = sum.LRV / n;
        const Density = avgY > 0 ? (-Math.log10(avgY / 100)).toFixed(2) : "0.00";

        const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
        const avgHex = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgBval)}`.toUpperCase();
        return { avgL, avgA, avgB_lab: avgB, avgR, avgG, avgB_rgb: avgBval, avgC, avgH, avgX, avgY, avgZ, cmyk, LRV, Density, avgHex };
    }, [displayMeasurements]);

    return (
        <div className="min-h-screen bg-[#0A0F14] text-slate-200 font-sans flex flex-col overflow-x-hidden">
            {/* Returning overlay — oculta todo el contenido mientras vuelve a la pantalla anterior */}
            {isReturning && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0A0F14]">
                    <div className="flex flex-col items-center gap-5">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center">
                                <BluetoothConnected className="w-8 h-8 text-green-400" />
                            </div>
                            <div className="absolute -inset-2 rounded-full border border-green-500/20 animate-ping" />
                        </div>
                        <p className="text-sm font-bold uppercase tracking-widest text-green-400">Dispositivo conectado</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Regresando...</p>
                    </div>
                </div>
            )}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onLogout={onLogout} userData={userData} />

            {/* Header */}
            <header className="fixed top-0 z-10 flex w-full items-center border-b border-black/10 bg-[#CC5200] shadow-lg px-6 py-4">
                <button onClick={() => navigate(returnTo || '/', { state: location.state })} className="p-2 text-black hover:text-white transition-colors hover:bg-black/10 rounded-lg mr-2">
                    <ArrowLeft className="h-5 w-5 text-white" />
                </button>
                <div className="flex-grow">
                    <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                        <Palette className="h-5 w-5 text-white" /> Colorímetro
                    </h1>
                    <p className="text-[10px] text-white/70 uppercase tracking-widest mt-1">Escaneo de Color Bluetooth · Nix Sensor</p>
                </div>
                {/* Settings button */}
                <button
                    id="colorimetro-device-settings-btn"
                    onClick={() => setIsDeviceSettingsOpen(true)}
                    className="ml-2 p-2 rounded-lg transition-all hover:bg-black/10 flex items-center justify-center"
                    aria-label="Configuración del dispositivo"
                    title="Configuración del dispositivo"
                >
                    <Settings className="h-5 w-5" />
                </button>
            </header>

            {/* Device Settings Panel */}
            <DeviceSettings
                isOpen={isDeviceSettingsOpen}
                onClose={() => setIsDeviceSettingsOpen(false)}
                isConnected={isConnected}
                onSettingsChange={reloadSettings}
            />

            <main className="pt-28 md:pt-32 pb-12 px-6 flex-grow container mx-auto max-w-5xl">

                {/* Soporte del navegador */}
                {!isSupported && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 mb-6">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-red-400 font-bold">Navegador No Compatible</h3>
                                <p className="text-sm text-slate-300 mt-1">
                                    Web Bluetooth no está disponible en este navegador. Por favor use <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong> u <strong>Opera</strong> en su última versión.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Error */}
                <AnimatePresence>
                    {error && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-center justify-between">
                            <span className="text-red-400 text-sm font-medium">{error}</span>
                            <button onClick={clearError} className="text-red-400 hover:text-red-300 text-xs underline">Cerrar</button>
                        </motion.div>
                    )}
                    {saveMessage.text && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className={`p-4 rounded-xl mb-6 text-sm font-semibold ${saveMessage.type === 'error'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-green-500/10 text-green-400 border border-green-500/20'
                                }`}>
                            {saveMessage.text}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Panel de Conexión */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

                    {/* Estado del dispositivo */}
                    <div className="lg:col-span-1 elegant-card p-6 flex flex-col items-center justify-between min-h-[310px]">
                        <div className="w-full flex flex-col items-center">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 mb-4 ${isConnected ? 'bg-green-500/20 border-2 border-green-500/50' :
                                isScanning || isConnecting ? 'bg-blue-500/20 border-2 border-blue-500/50 animate-pulse' :
                                    'bg-slate-800 border-2 border-slate-700'
                                }`}>
                                {isConnected ? <BluetoothConnected className="w-9 h-9 text-green-400" /> :
                                    isScanning || isConnecting ? <BluetoothSearching className="w-9 h-9 text-blue-400 animate-spin" /> :
                                        <BluetoothOff className="w-9 h-9 text-slate-500" />
                                }
                            </div>

                            <div className="text-center w-full">
                                <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">{status}</p>
                                {isConnected && deviceInfo && (
                                    <div className="flex items-center justify-center gap-1.5 mt-1 mb-2">
                                        <Battery className="w-4 h-4 text-green-500 dark:text-green-400" />
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{deviceInfo.batteryLevel}%</span>
                                    </div>
                                )}
                                {isConnected && deviceInfo && (deviceInfo.firmwareVersion || deviceInfo.serialNumber) && (
                                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-700/20 pt-3 text-[11px] w-full">
                                        {deviceInfo.firmwareVersion && (
                                            <div className="text-center">
                                                <p className="font-bold uppercase tracking-wider text-[8px] text-[#a38105] mb-0.5">FW</p>
                                                <p className="text-slate-600 dark:text-slate-300 font-medium truncate">{deviceInfo.firmwareVersion}</p>
                                            </div>
                                        )}
                                        {deviceInfo.serialNumber && (
                                            <div className="text-center border-l border-slate-700/10">
                                                <p className="font-bold uppercase tracking-wider text-[8px] text-[#a38105] mb-0.5">S/N</p>
                                                <p className="text-slate-600 dark:text-slate-300 font-medium truncate">{deviceInfo.serialNumber}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Botones */}
                        <div className="w-full space-y-2.5 mt-5">
                            {!isConnected ? (
                                <>
                                    <button
                                        onClick={scan}
                                        disabled={!isSupported || isScanning || isConnecting}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#a38105] hover:bg-[#c49f0a] text-white rounded-lg font-bold uppercase tracking-widest text-xs transition-all disabled:bg-slate-700 disabled:text-slate-500"
                                    >
                                        {isScanning || isConnecting ? (
                                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Buscando...</>
                                        ) : (
                                            <><Bluetooth className="w-4 h-4" /> Conectar Nix</>
                                        )}
                                    </button>
                                    {(isScanning || isConnecting) && (
                                        <button
                                            onClick={cancelScan}
                                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600/20 hover:bg-red-600/40 border border-red-600/30 text-red-400 hover:text-red-300 rounded-lg font-bold uppercase tracking-widest text-xs transition-all"
                                        >
                                            <BluetoothOff className="w-4 h-4" /> Cancelar búsqueda
                                        </button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={measure}
                                        disabled={isMeasuring}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#a38105] hover:bg-[#c49f0a] text-white rounded-lg font-bold uppercase tracking-widest text-xs transition-all disabled:bg-slate-700 disabled:text-slate-500"
                                    >
                                        {isMeasuring ? (
                                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Escaneando...</>
                                        ) : (
                                            <><Scan className="w-4 h-4" /> Escanear Color</>
                                        )}
                                    </button>
                                    <button
                                        onClick={disconnect}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600/20 hover:bg-red-600/40 text-red-600 dark:text-red-400 rounded-lg font-bold uppercase tracking-widest text-xs transition-all"
                                    >
                                        <BluetoothOff className="w-4 h-4" /> Desconectar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Vista previa del color — Última Medición */}
                    <div className="lg:col-span-2 elegant-card p-6">
                        <h3 className="text-xs font-bold text-[#a38105] uppercase tracking-widest mb-4">Última Medición</h3>

                        {displayLastMeasurement ? (
                            <div className="flex flex-col md:flex-row gap-5">
                                {/* Swatch grande */}
                                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                                    <div
                                        className="w-32 h-32 rounded-2xl shadow-2xl transition-all duration-500 border border-slate-300/20 dark:border-slate-700/50"
                                        style={{ backgroundColor: displayLastMeasurement.color.hex }}
                                    />
                                </div>

                                {/* Datos agrupados por filas */}
                                <div className="flex-grow flex flex-col gap-2 justify-center">

                                    {/* Fila 1: L* a* b* */}
                                    {settings.displayColorFields.includes('CIELAB') && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 w-10 flex-shrink-0">L*a*b*</span>
                                            <div className="flex flex-1 gap-1.5">
                                                {[
                                                    { label: 'L*', value: displayLastMeasurement.color.L },
                                                    { label: 'a*', value: displayLastMeasurement.color.a },
                                                    { label: 'b*', value: displayLastMeasurement.color.b },
                                                ].map(item => (
                                                    <div key={item.label} className="flex-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-2 py-1.5 text-center border border-slate-200/50 dark:border-slate-700/30">
                                                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                                                        <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{formatDecimals(item.value)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Fila 2: R G B */}
                                    {settings.displayColorFields.includes('sRGB') && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 w-10 flex-shrink-0">RGB</span>
                                            <div className="flex flex-1 gap-1.5">
                                                {[
                                                    { label: 'R', value: displayLastMeasurement.color.R },
                                                    { label: 'G', value: displayLastMeasurement.color.G },
                                                    { label: 'B', value: displayLastMeasurement.color.B },
                                                ].map(item => (
                                                    <div key={item.label} className="flex-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-2 py-1.5 text-center border border-slate-200/50 dark:border-slate-700/30">
                                                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                                                        <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{formatDecimals(item.value)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Fila 3: C, H° y Hex */}
                                    {(settings.displayColorFields.includes('LCH(ab)') || settings.displayColorFields.includes('HTX')) && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 w-10 flex-shrink-0">C / H</span>
                                            <div className="flex flex-1 gap-1.5">
                                                {[
                                                    ...(settings.displayColorFields.includes('LCH(ab)') ? [
                                                        { label: 'C', value: displayLastMeasurement.color.C },
                                                        { label: 'H°', value: displayLastMeasurement.color.H }
                                                    ] : []),
                                                    ...(settings.displayColorFields.includes('HTX') ? [
                                                        { label: 'Hex', value: displayLastMeasurement.color.hex.toUpperCase() }
                                                    ] : [])
                                                ].map(item => (
                                                    <div key={item.label} className="flex-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-2 py-1.5 text-center border border-slate-200/50 dark:border-slate-700/30">
                                                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                                                        <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{item.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* XYZ */}
                                    {settings.displayColorFields.includes('CIEXYZ') && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 w-10 flex-shrink-0">XYZ</span>
                                            <div className="flex flex-1 gap-1.5">
                                                {[
                                                    { label: 'X', value: displayLastMeasurement.color.X },
                                                    { label: 'Y', value: displayLastMeasurement.color.Y },
                                                    { label: 'Z', value: displayLastMeasurement.color.Z },
                                                ].map(item => (
                                                    <div key={item.label} className="flex-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-2 py-1.5 text-center border border-slate-200/50 dark:border-slate-700/30">
                                                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                                                        <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{formatDecimals(item.value)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* CMYK */}
                                    {settings.displayColorFields.includes('CMYK') && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 w-10 flex-shrink-0">CMYK</span>
                                            <div className="flex flex-1 gap-1.5">
                                                {[
                                                    { label: 'C', value: displayLastMeasurement.color.cmyk.C },
                                                    { label: 'M', value: displayLastMeasurement.color.cmyk.M },
                                                    { label: 'Y', value: displayLastMeasurement.color.cmyk.Y },
                                                    { label: 'K', value: displayLastMeasurement.color.cmyk.K },
                                                ].map(item => (
                                                    <div key={item.label} className="flex-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-2 py-1.5 text-center border border-slate-200/50 dark:border-slate-700/30">
                                                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                                                        <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{item.value}%</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* LRV & Density */}
                                    {(settings.displayColorFields.includes('LRV') || settings.displayColorFields.includes('Density')) && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 w-10 flex-shrink-0">EXT</span>
                                            <div className="flex flex-1 gap-1.5">
                                                {[
                                                    ...(settings.displayColorFields.includes('LRV') ? [{ label: 'LRV', value: displayLastMeasurement.color.LRV }] : []),
                                                    ...(settings.displayColorFields.includes('Density') ? [{ label: 'Dens', value: displayLastMeasurement.color.Density }] : []),
                                                ].map(item => (
                                                    <div key={item.label} className="flex-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-2 py-1.5 text-center border border-slate-200/50 dark:border-slate-700/30">
                                                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                                                        <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{item.value}</p>
                                                    </div>
                                                ))}
                                                <div className="flex-1" />
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                                <Scan className="w-12 h-12 opacity-30 mb-3" />
                                <p className="text-sm">Conecta un dispositivo Nix y escanea un color</p>
                                <p className="text-xs mt-1 opacity-50">Los datos L*a*b*, RGB y espectral aparecerán aquí</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Promedio de mediciones */}
                {averages && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="elegant-card p-6">
                        <h3 className="text-xs font-bold text-[#a38105] uppercase tracking-widest mb-4">
                            Promedio de Mediciones ({displayMeasurements.length})
                        </h3>
                        <div className="flex flex-col md:flex-row gap-5">
                            <div className="flex flex-col items-center gap-2 flex-shrink-0">
                                <div
                                    className="w-24 h-24 rounded-2xl shadow-2xl border border-slate-300/20 dark:border-slate-700/50"
                                    style={{ backgroundColor: averages.avgHex }}
                                />
                                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white tracking-wider">{averages.avgHex}</span>
                            </div>
                            <div className="flex-grow flex flex-col gap-2 justify-center">
                                {settings.displayColorFields.includes('CIELAB') && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 w-10 flex-shrink-0">L*a*b*</span>
                                        <div className="flex flex-1 gap-1.5">
                                            {[
                                                { label: 'L*', value: averages.avgL },
                                                { label: 'a*', value: averages.avgA },
                                                { label: 'b*', value: averages.avgB_lab },
                                            ].map(item => (
                                                <div key={item.label} className="flex-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-2 py-1.5 text-center border border-slate-200/50 dark:border-slate-700/30">
                                                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                                                    <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{formatDecimals(item.value)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {settings.displayColorFields.includes('sRGB') && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 w-10 flex-shrink-0">RGB</span>
                                        <div className="flex flex-1 gap-1.5">
                                            {[
                                                { label: 'R', value: averages.avgR },
                                                { label: 'G', value: averages.avgG },
                                                { label: 'B', value: averages.avgB_rgb },
                                            ].map(item => (
                                                <div key={item.label} className="flex-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-2 py-1.5 text-center border border-slate-200/50 dark:border-slate-700/30">
                                                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                                                    <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{formatDecimals(item.value)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {(settings.displayColorFields.includes('LCH(ab)') || settings.displayColorFields.includes('HTX')) && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 w-10 flex-shrink-0">C / H</span>
                                        <div className="flex flex-1 gap-1.5">
                                            {[
                                                ...(settings.displayColorFields.includes('LCH(ab)') ? [
                                                    { label: 'C', value: averages.avgC },
                                                    { label: 'H°', value: averages.avgH }
                                                ] : []),
                                                ...(settings.displayColorFields.includes('HTX') ? [
                                                    { label: 'Hex', value: averages.avgHex }
                                                ] : [])
                                            ].map(item => (
                                                <div key={item.label} className="flex-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-2 py-1.5 text-center border border-slate-200/50 dark:border-slate-700/30">
                                                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                                                    <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{formatDecimals(item.value)}</p>
                                                </div>
                                            ))}
                                            <div className="flex-1" />
                                        </div>
                                    </div>
                                )}
                                {settings.displayColorFields.includes('CIEXYZ') && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 w-10 flex-shrink-0">XYZ</span>
                                        <div className="flex flex-1 gap-1.5">
                                            {[
                                                { label: 'X', value: averages.avgX || 0 },
                                                { label: 'Y', value: averages.avgY || 0 },
                                                { label: 'Z', value: averages.avgZ || 0 },
                                            ].map(item => (
                                                <div key={item.label} className="flex-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-2 py-1.5 text-center border border-slate-200/50 dark:border-slate-700/30">
                                                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                                                    <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{formatDecimals(item.value)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {settings.displayColorFields.includes('CMYK') && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 w-10 flex-shrink-0">CMYK</span>
                                        <div className="flex flex-1 gap-1.5">
                                            {[
                                                { label: 'C', value: averages.cmyk?.C || 0 },
                                                { label: 'M', value: averages.cmyk?.M || 0 },
                                                { label: 'Y', value: averages.cmyk?.Y || 0 },
                                                { label: 'K', value: averages.cmyk?.K || 0 },
                                            ].map(item => (
                                                <div key={item.label} className="flex-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-2 py-1.5 text-center border border-slate-200/50 dark:border-slate-700/30">
                                                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                                                    <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{item.value}%</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {(settings.displayColorFields.includes('LRV') || settings.displayColorFields.includes('Density')) && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 w-10 flex-shrink-0">EXT</span>
                                        <div className="flex flex-1 gap-1.5">
                                            {[
                                                ...(settings.displayColorFields.includes('LRV') ? [{ label: 'LRV', value: averages.LRV || 0 }] : []),
                                                ...(settings.displayColorFields.includes('Density') ? [{ label: 'Dens', value: averages.Density || '0.00' }] : []),
                                            ].map(item => (
                                                <div key={item.label} className="flex-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-2 py-1.5 text-center border border-slate-200/50 dark:border-slate-700/30">
                                                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                                                    <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{item.value}</p>
                                                </div>
                                            ))}
                                            <div className="flex-1" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Historial de mediciones */}
                {displayMeasurements.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="elegant-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-[#a38105] uppercase tracking-widest">
                                Historial de Mediciones ({displayMeasurements.length})
                            </h3>
                            <button onClick={() => setShowClearConfirm(true)}
                                className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 uppercase tracking-widest font-bold">
                                <Trash2 className="w-3 h-3" /> Limpiar
                            </button>
                        </div>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                            {displayMeasurements.map((m, idx) => {
                                const prevMeasurement = idx < displayMeasurements.length - 1 ? displayMeasurements[idx + 1] : null;
                                const dE = prevMeasurement ? deltaE2000(m.color.L, m.color.a, m.color.b, prevMeasurement.color.L, prevMeasurement.color.a, prevMeasurement.color.b) : null;

                                return (
                                    <div key={m.timestamp} className="flex items-center gap-4 bg-slate-100 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-200/50 dark:border-slate-800/80 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors">
                                        {/* Swatch */}
                                        <div className="w-12 h-12 rounded-lg flex-shrink-0" style={{ backgroundColor: m.color.hex }} />

                                        {/* Datos */}
                                        <div className="flex-grow min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">{m.color.hex.toUpperCase()}</span>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400">{new Date(m.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                                L*{formatDecimals(m.color.L)} a*{formatDecimals(m.color.a)} b*{formatDecimals(m.color.b)}
                                                {dE !== null && (
                                                    <span className={`ml-2 font-bold ${dE < 1 ? 'text-green-600 dark:text-green-400' : dE < 3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        ΔE={formatDecimals(dE)}
                                                    </span>
                                                )}
                                            </p>
                                        </div>

                                        {/* Eliminar */}
                                        <button
                                            onClick={() => setPendingDelete(m.timestamp)}
                                            className="flex items-center gap-1 px-2 py-2 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex-shrink-0"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

            </main>

            {/* Confirmación de borrado */}
            <AnimatePresence>
                {pendingDelete && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setPendingDelete(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl overflow-hidden"
                        >
                            <div className="relative">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Eliminar medición</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                                    Esta acción no se puede deshacer. ¿Deseas eliminar esta medición?
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setPendingDelete(null)}
                                        className="flex-1 px-6 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => {
                                            removeMeasurement(pendingDelete);
                                            setPendingDelete(null);
                                        }}
                                        className="flex-1 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-red-900/20"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Confirmación de reinicio */}
            <AnimatePresence>
                {showClearConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowClearConfirm(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl overflow-hidden"
                        >
                            <div className="relative">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Limpiar mediciones</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                                    {displayMeasurements.length > 0
                                        ? `Tienes ${displayMeasurements.length} medición${displayMeasurements.length !== 1 ? 'es' : ''} sin guardar. Se perderán todos los datos. ¿Deseas continuar?`
                                        : 'No hay mediciones activas. ¿Deseas limpiar de todas formas?'}
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowClearConfirm(false)}
                                        className="flex-1 px-6 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => {
                                            clearMeasurements();
                                            setShowClearConfirm(false);
                                        }}
                                        className="flex-1 px-6 py-3 rounded-xl bg-[#D4672A] hover:bg-[#D4672A]/80 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                                    >
                                        Limpiar
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
