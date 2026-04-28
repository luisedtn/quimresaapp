import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Settings, Bluetooth, Check, RefreshCcw,
  Scan as ScanIcon, Battery, Wifi, AlertTriangle, BluetoothOff,
  BluetoothSearching, BluetoothConnected, Save
} from 'lucide-react';
import { useNixDevice } from '../hooks/useNixDevice';
import { API_BASE_URL } from '../config';
import { deltaE2000 } from '../services/NixBluetoothService';

interface ScanProps {
  userData?: any;
  onLogout?: () => void;
}

export default function Scan({ userData, onLogout }: ScanProps) {
  const navigate = useNavigate();
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });
  const [isSaving, setIsSaving] = useState(false);

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
    clearError,
  } = useNixDevice();

  // Calculate Delta E if we have at least 2 measurements
  const dE = (measurements.length >= 2)
    ? deltaE2000(
      measurements[0].color.L, measurements[0].color.a, measurements[0].color.b,
      measurements[1].color.L, measurements[1].color.a, measurements[1].color.b
    )
    : null;

  const handleSaveMeasurement = async () => {
    if (!lastMeasurement) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/mediciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          L: lastMeasurement.color.L,
          A: lastMeasurement.color.a,
          B: lastMeasurement.color.b,
          R: lastMeasurement.color.R.toString(),
          G: lastMeasurement.color.G.toString(),
          RB: lastMeasurement.color.B.toString(),
          C: lastMeasurement.color.C.toString(),
          H: lastMeasurement.color.H.toString(),
          FECHA: lastMeasurement.timestamp,
        }),
      });

      if (!res.ok) {
        if ((res.status === 401 || res.status === 403) && onLogout) {
          onLogout();
        }
        throw new Error('Error al guardar la medición');
      }

      setSaveMessage({ type: 'success', text: '¡Medición guardada correctamente!' });
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage({ type: '', text: '' }), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F14] text-slate-200 font-sans flex flex-col">
      {/* Header */}
      <header className="fixed top-0 z-10 flex w-full items-center justify-between border-b border-slate-800 bg-[#0A0F14]/80 backdrop-blur-md px-4 py-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="p-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-tight">Escaneo único</h1>
        </div>

        {isConnected && deviceInfo && (
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span className="flex items-center gap-1 text-green-400">
              <BluetoothConnected className="w-3 h-3" /> {deviceInfo.name}
            </span>
            <span className="flex items-center gap-1">
              <Battery className="w-3 h-3" /> {deviceInfo.batteryLevel}%
            </span>
          </div>
        )}

        <button className="p-2 text-slate-400 hover:text-white transition-colors">
          <Settings className="h-6 w-6" />
        </button>
      </header>

      <main className="flex flex-col items-center pt-24 px-6 max-w-lg mx-auto w-full flex-grow">

        {/* Browser support alert */}
        {!isSupported && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 w-full">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300">
                Web Bluetooth no disponible. Use Chrome o Edge.
              </p>
            </div>
          </div>
        )}

        {/* Error or Success notification */}
        <AnimatePresence>
          {(error || saveMessage.text) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`p-4 rounded-xl mb-6 w-full text-xs font-semibold ${(error || saveMessage.type === 'error')
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-green-500/10 text-green-400 border border-green-500/20'
                }`}
            >
              <div className="flex justify-between items-center">
                <span>{error || saveMessage.text}</span>
                {error && <button onClick={clearError} className="underline uppercase tracking-widest text-[8px]">Cerrar</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isConnected && !isConnecting && !isScanning ? (
          <div className="flex w-full flex-col items-center gap-8 text-center mt-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-64 w-full items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-transparent"></div>
              <div className="relative">
                <Bluetooth className="h-16 w-16 text-blue-500/40" />
                <div className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-blue-500/20 border border-blue-500/50"></div>
              </div>
            </motion.div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Conecta tu dispositivo Nix</h2>
              <p className="mt-2 text-slate-500 text-sm">Coloca tu dispositivo Nix cerca de tu smartphone y presiona 'Conectar a Nix' para comenzar.</p>
            </div>
            <button
              onClick={() => navigate('/colorimetro', { state: { returnTo: '/scan' } })}
              disabled={!isSupported || isScanning || isConnecting}
              className="w-full rounded-lg bg-[#004A99] hover:bg-blue-600 py-4 font-bold transition-all active:scale-95 shadow-lg shadow-blue-900/20 uppercase tracking-widest text-sm disabled:opacity-50 disabled:bg-slate-800"
            >
              {isScanning ? 'Buscando...' : 'Conectar a Nix'}
            </button>
          </div>
        ) : isConnecting ? (
          <div className="flex w-full flex-col items-center rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-2xl mt-12">
            <h2 className="mb-8 text-xl font-bold text-white tracking-tight">Conectando a Nix</h2>
            <div className="space-y-6 w-full">
              <div className="flex items-center gap-4 text-sm">
                <div className="rounded-full bg-emerald-500/20 p-1"><Check className="h-4 w-4 text-emerald-500" /></div>
                <span className="text-slate-300">Dispositivo encontrado</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="h-6 w-6 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin"></div>
                <span className="text-white font-medium">Sincronizando...</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600 font-medium">
                <div className="w-6 h-6"></div>
                <span>Preparando interface...</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-6">
            {/* Color Result Card */}
            <motion.div
              layoutId="color-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-80 w-full rounded-3xl overflow-hidden shadow-2xl relative border-4 border-slate-900 transition-all duration-500 ease-out"
              style={{ backgroundColor: lastMeasurement?.color.hex || '#1a1a1a' }}
            >
              <div className="absolute top-4 right-4 flex gap-2">
                <div className="px-2 py-1 bg-black/40 backdrop-blur-md rounded text-[10px] font-bold text-white/90 tracking-widest uppercase border border-white/10">
                  {deviceInfo?.type || 'Nix Device'}
                </div>
              </div>

              {isMeasuring && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mb-4"></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-400 animate-pulse">Capturando Datos</p>
                </div>
              )}

              {lastMeasurement && !isMeasuring && (
                <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                  <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                    <span className="text-white font-mono font-bold tracking-tighter text-lg uppercase">
                      {lastMeasurement.color.hex}
                    </span>
                  </div>

                  <button
                    onClick={handleSaveMeasurement}
                    disabled={isSaving}
                    className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/10 text-white transition-all active:scale-90"
                  >
                    {isSaving ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  </button>
                </div>
              )}
            </motion.div>

            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">D50, 2°, M2</p>
                  {dE !== null && (
                    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-800">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">ΔE₀₀:</span>
                      <span className={`text-[10px] font-bold ${dE < 1.0 ? 'text-green-400' : dE < 2.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {dE.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
                {lastMeasurement && (
                  <p className="text-slate-600 text-[10px] uppercase font-bold tracking-widest">
                    {new Date(lastMeasurement.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl px-5 divide-y divide-slate-800/50 shadow-inner">
                <div className="py-4 flex justify-between items-center transition-all hover:translate-x-1">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">CIELAB</span>
                  <span className="font-mono text-base text-white">
                    {lastMeasurement ? `${lastMeasurement.color.L}, ${lastMeasurement.color.a}, ${lastMeasurement.color.b}` : '--'}
                  </span>
                </div>
                <div className="py-4 flex justify-between items-center transition-all hover:translate-x-1">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">RGB</span>
                  <span className="font-mono text-base text-white uppercase">
                    {lastMeasurement ? `${lastMeasurement.color.R}, ${lastMeasurement.color.G}, ${lastMeasurement.color.B}` : '--'}
                  </span>
                </div>
                <div className="py-4 flex justify-between items-center transition-all hover:translate-x-1">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">CHROMA / HUE</span>
                  <span className="font-mono text-base text-white">
                    {lastMeasurement ? `${lastMeasurement.color.C} / ${lastMeasurement.color.H}°` : '--'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                disabled={isMeasuring}
                onClick={measure}
                className="flex-[2] flex items-center justify-center gap-3 rounded-2xl bg-white hover:bg-slate-200 py-5 font-bold text-black transition-all active:scale-95 disabled:bg-slate-700 disabled:text-slate-400 group overflow-hidden relative shadow-xl shadow-white/5"
              >
                {isMeasuring ? (
                  <RefreshCcw className="h-5 w-5 animate-spin" />
                ) : (
                  <ScanIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
                )}
                <span className="uppercase tracking-widest text-xs font-extrabold">
                  {isMeasuring ? 'Procesando...' : 'Escanear con Nix'}
                </span>
              </button>

              <button
                onClick={disconnect}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 py-5 text-red-500 transition-all active:scale-95"
              >
                <BluetoothOff className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="p-6 text-center">
        <p className="text-[9px] text-slate-700 uppercase font-bold tracking-[0.2em]">
          {status} {deviceInfo?.serialNumber ? `· S/N: ${deviceInfo.serialNumber}` : ''}
        </p>
      </footer>
    </div>
  );
}
