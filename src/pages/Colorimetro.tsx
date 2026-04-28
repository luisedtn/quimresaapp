import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    ArrowLeft, Bluetooth, BluetoothSearching, BluetoothConnected, BluetoothOff,
    Scan, Battery, Wifi, AlertTriangle, Check, Trash2, Save, Palette
} from 'lucide-react';
import { API_BASE_URL } from '../config';

import Sidebar from '../components/Sidebar';
import { useNixDevice } from '../hooks/useNixDevice';
import { NixBluetoothService, deltaE2000, NixMeasurement } from '../services/NixBluetoothService';

export default function Colorimetro({ userData, onLogout }: { userData: any; onLogout: () => void }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });

    const returnTo = location.state?.returnTo;

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
        disconnect,
        measure,
        clearMeasurements,
        clearError,
    } = useNixDevice();

    // Auto-return logic when connected if we came from Scan
    useEffect(() => {
        if (isConnected && returnTo) {
            const timer = setTimeout(() => {
                navigate(returnTo);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isConnected, returnTo, navigate]);

    const handleSaveMeasurement = async (m: NixMeasurement) => {
        setSavingId(m.timestamp);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/mediciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    L: m.color.L, A: m.color.a, B: m.color.b,
                    R: m.color.R.toString(), G: m.color.G.toString(), RB: m.color.B.toString(),
                    C: m.color.C.toString(), H: m.color.H.toString(),
                    FECHA: m.timestamp,
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

    return (
        <div className="min-h-screen bg-[#0A0F14] text-slate-200 font-sans flex flex-col">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onLogout={onLogout} userData={userData} />

            {/* Header */}
            <header className="fixed top-0 z-10 flex w-full items-center border-b border-slate-800 bg-[#0A0F14]/80 backdrop-blur-md px-6 py-4">
                <button onClick={() => navigate(returnTo || '/')} className="p-2 text-slate-400 hover:text-white transition-colors hover:bg-slate-800/50 rounded-lg mr-2">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-grow">
                    <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                        <Palette className="h-5 w-5 text-violet-400" /> Colorímetro
                    </h1>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Escaneo de Color Bluetooth · Nix Sensor</p>
                </div>
                {isConnected && deviceInfo && (
                    <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-green-400">
                            <BluetoothConnected className="w-4 h-4" /> {deviceInfo.name}
                        </span>
                        <span className="flex items-center gap-1 text-slate-400">
                            <Battery className="w-4 h-4" /> {deviceInfo.batteryLevel}%
                        </span>
                    </div>
                )}
            </header>

            <main className="pt-24 pb-12 px-6 flex-grow container mx-auto max-w-5xl">

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
                    <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center gap-4">
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${isConnected ? 'bg-green-500/20 border-2 border-green-500/50' :
                            isScanning || isConnecting ? 'bg-blue-500/20 border-2 border-blue-500/50 animate-pulse' :
                                'bg-slate-800 border-2 border-slate-700'
                            }`}>
                            {isConnected ? <BluetoothConnected className="w-10 h-10 text-green-400" /> :
                                isScanning || isConnecting ? <BluetoothSearching className="w-10 h-10 text-blue-400 animate-spin" /> :
                                    <BluetoothOff className="w-10 h-10 text-slate-500" />
                            }
                        </div>

                        <div className="text-center">
                            <p className="text-sm font-bold text-white">{status}</p>
                            {isConnected && deviceInfo && (
                                <div className="mt-2 text-xs text-slate-400 space-y-1">
                                    <p>Tipo: <span className="text-slate-300">{deviceInfo.type}</span></p>
                                    {deviceInfo.firmwareVersion && <p>FW: <span className="text-slate-300">{deviceInfo.firmwareVersion}</span></p>}
                                    {deviceInfo.serialNumber && <p>S/N: <span className="text-slate-300">{deviceInfo.serialNumber}</span></p>}
                                </div>
                            )}
                        </div>

                        {/* Botones */}
                        <div className="w-full space-y-2">
                            {!isConnected ? (
                                <button
                                    onClick={scan}
                                    disabled={!isSupported || isScanning || isConnecting}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-bold uppercase tracking-widest text-xs transition-all disabled:bg-slate-700 disabled:text-slate-500"
                                >
                                    {isScanning || isConnecting ? (
                                        <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Buscando...</>
                                    ) : (
                                        <><Bluetooth className="w-4 h-4" /> Conectar Nix</>
                                    )}
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={measure}
                                        disabled={isMeasuring}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold uppercase tracking-widest text-xs transition-all disabled:bg-slate-700 disabled:text-slate-500"
                                    >
                                        {isMeasuring ? (
                                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Escaneando...</>
                                        ) : (
                                            <><Scan className="w-4 h-4" /> Escanear Color</>
                                        )}
                                    </button>
                                    <button
                                        onClick={disconnect}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all"
                                    >
                                        <BluetoothOff className="w-3 h-3" /> Desconectar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Vista previa del color */}
                    <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-4">Última Medición</h3>

                        {lastMeasurement ? (
                            <div className="flex flex-col md:flex-row gap-6">
                                {/* Swatch grande */}
                                <div className="flex flex-col items-center gap-3">
                                    <div
                                        className="w-40 h-40 rounded-2xl border-4 border-slate-700 shadow-2xl transition-all duration-500"
                                        style={{ backgroundColor: lastMeasurement.color.hex }}
                                    />
                                    <span className="text-lg font-mono font-bold text-white tracking-wider">
                                        {lastMeasurement.color.hex.toUpperCase()}
                                    </span>
                                </div>

                                {/* Datos */}
                                <div className="flex-grow grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {[
                                        { label: 'L*', value: lastMeasurement.color.L, color: 'text-yellow-400' },
                                        { label: 'a*', value: lastMeasurement.color.a, color: 'text-red-400' },
                                        { label: 'b*', value: lastMeasurement.color.b, color: 'text-blue-400' },
                                        { label: 'R', value: lastMeasurement.color.R, color: 'text-red-400' },
                                        { label: 'G', value: lastMeasurement.color.G, color: 'text-green-400' },
                                        { label: 'B', value: lastMeasurement.color.B, color: 'text-blue-400' },
                                        { label: 'C', value: lastMeasurement.color.C, color: 'text-purple-400' },
                                        { label: 'H°', value: lastMeasurement.color.H, color: 'text-orange-400' },
                                    ].map(item => (
                                        <div key={item.label} className="bg-slate-800/60 rounded-lg p-3 text-center">
                                            <p className={`text-[10px] font-bold uppercase tracking-widest ${item.color}`}>{item.label}</p>
                                            <p className="text-lg font-mono font-bold text-white">{item.value}</p>
                                        </div>
                                    ))}
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

                {/* Historial de mediciones */}
                {measurements.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest">
                                Historial de Mediciones ({measurements.length})
                            </h3>
                            <button onClick={clearMeasurements}
                                className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 uppercase tracking-widest font-bold">
                                <Trash2 className="w-3 h-3" /> Limpiar
                            </button>
                        </div>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                            {measurements.map((m, idx) => {
                                const prevMeasurement = idx < measurements.length - 1 ? measurements[idx + 1] : null;
                                const dE = prevMeasurement ? deltaE2000(m.color.L, m.color.a, m.color.b, prevMeasurement.color.L, prevMeasurement.color.a, prevMeasurement.color.b) : null;

                                return (
                                    <div key={m.timestamp} className="flex items-center gap-4 bg-slate-800/40 rounded-lg p-3 hover:bg-slate-800/60 transition-colors">
                                        {/* Swatch */}
                                        <div className="w-12 h-12 rounded-lg border-2 border-slate-700 flex-shrink-0" style={{ backgroundColor: m.color.hex }} />

                                        {/* Datos */}
                                        <div className="flex-grow min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-bold text-white">{m.color.hex.toUpperCase()}</span>
                                                <span className="text-[10px] text-slate-500">{new Date(m.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                L*{m.color.L} a*{m.color.a} b*{m.color.b}
                                                {dE !== null && (
                                                    <span className={`ml-2 font-bold ${dE < 1 ? 'text-green-400' : dE < 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                        ΔE={dE.toFixed(2)}
                                                    </span>
                                                )}
                                            </p>
                                        </div>

                                        {/* Acciones */}
                                        <button
                                            onClick={() => handleSaveMeasurement(m)}
                                            disabled={savingId === m.timestamp}
                                            className="flex items-center gap-1 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex-shrink-0 disabled:opacity-50"
                                        >
                                            {savingId === m.timestamp ? (
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400" />
                                            ) : (
                                                <><Save className="w-3 h-3" /> Guardar</>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

            </main>
        </div>
    );
}
