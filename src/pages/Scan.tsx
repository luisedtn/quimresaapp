import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Settings, Bluetooth, Check, RefreshCcw, RotateCcw,
  Scan as ScanIcon, Battery, Wifi, AlertTriangle, BluetoothOff,
  BluetoothSearching, BluetoothConnected, Save, Share2, List,
  History, X, Trash2
} from 'lucide-react';
import { Share as CapShare } from '@capacitor/share';
import DeviceSettings from '../components/DeviceSettings';
import GuardarEscaneo from '../components/GuardarEscaneo';
import HistorialMediciones from '../components/HistorialMediciones';
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
  const [isDeviceSettingsOpen, setIsDeviceSettingsOpen] = useState(false);
  const [isHistorialOpen, setIsHistorialOpen] = useState(false);
  const [historyMeasurement, setHistoryMeasurement] = useState<any>(null);
  const [pendingDelete, setPendingDelete] = useState<{ timestamp: string; num: number } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const mapApiToNixFormat = (m: any) => ({
    color: {
      L: m.L, a: m.A, b: m.B,
      R: m.R, G: m.G, B: m.RB,
      C: m.C, H: m.H,
      X: m.X, Y: m.Y, Z: m.Z,
      hex: m.hex,
      LRV: m.LRV,
      Density: m.Density,
      cmyk: { C: m.cmykC, M: m.cmykM, Y: m.cmykY, K: m.cmykK }
    },
    timestamp: m.fecha,
    nombre: m.nombre,
    blancoReferencia: m.blanco_referencia,
    modoMedicion: m.modo_medicion,
    densidadStatus: m.densidad,
    promedio: m.promedio
  });

  const handleSelectMeasurement = (medicion: any) => {
    setHistoryMeasurement(mapApiToNixFormat(medicion));
    clearMeasurements();
  };

  const fmt = (val: any) => {
    const n = Number(val);
    return isNaN(n) ? val : n.toFixed(2);
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
    disconnect,
    measure,
    clearError,
    clearMeasurements,
    removeMeasurement,
    settings,
    reloadSettings,
  } = useNixDevice();

  const averages = useMemo(() => {
    if (measurements.length === 0) return null;
    const sum = { L: 0, a: 0, b: 0, R: 0, G: 0, B: 0, C: 0, H: 0, X: 0, Y: 0, Z: 0, cmykC: 0, cmykM: 0, cmykY: 0, cmykK: 0, LRV: 0 };
    measurements.forEach(m => {
      sum.L += m.color.L;
      sum.a += m.color.a;
      sum.b += m.color.b;
      sum.R += m.color.R || 0;
      sum.G += m.color.G || 0;
      sum.B += m.color.B || 0;
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
    const n = measurements.length;
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
  }, [measurements]);

  const isAverageMode = settings.measurementTrigger === 'manual' && measurements.length > 1 && averages !== null;

  const displayMeasurement = historyMeasurement
    ? historyMeasurement
    : isAverageMode
      ? {
        color: {
          L: averages!.avgL,
          a: averages!.avgA,
          b: averages!.avgB_lab,
          R: averages!.avgR,
          G: averages!.avgG,
          B: averages!.avgB_rgb,
          C: averages!.avgC,
          H: averages!.avgH,
          X: averages!.avgX,
          Y: averages!.avgY,
          Z: averages!.avgZ,
          hex: averages!.avgHex,
          LRV: averages!.LRV,
          Density: averages!.Density,
          cmyk: averages!.cmyk,
        },
        timestamp: lastMeasurement?.timestamp || new Date().toISOString(),
      }
      : lastMeasurement;

  // Calculate Delta E between the two most recent measurements
  const dE = (measurements.length >= 2)
    ? deltaE2000(
      measurements[0].color.L, measurements[0].color.a, measurements[0].color.b,
      measurements[1].color.L, measurements[1].color.a, measurements[1].color.b
    )
    : null;

  const handleShare = async () => {
    const target = displayMeasurement;
    if (!target) return;

    const c = target.color;
    const lines: string[] = [];
    lines.push(`Color Escaneado Nix · ${settings.referenceWhite} · ${settings.measurementMode}`);
    if (settings.displayColorFields.includes('HTX')) lines.push(`HEX: ${c.hex}`);
    if (settings.displayColorFields.includes('CIELAB')) lines.push(`CIELAB: ${fmt(c.L)}, ${fmt(c.a)}, ${fmt(c.b)}`);
    if (settings.displayColorFields.includes('sRGB')) lines.push(`sRGB: ${c.R}, ${c.G}, ${c.B}`);
    if (settings.displayColorFields.includes('LCH(ab)')) lines.push(`LCH(ab): ${fmt(c.L)}, ${fmt(c.C)}, ${fmt(c.H)}°`);
    if (settings.displayColorFields.includes('CIEXYZ')) lines.push(`CIEXYZ: ${fmt(c.X)}, ${fmt(c.Y)}, ${fmt(c.Z)}`);
    if (settings.displayColorFields.includes('CMYK')) lines.push(`CMYK: ${fmt(c.cmyk.C)}%, ${fmt(c.cmyk.M)}%, ${fmt(c.cmyk.Y)}%, ${fmt(c.cmyk.K)}%`);
    if (settings.displayColorFields.includes('LRV')) lines.push(`LRV: ${c.LRV}`);
    if (settings.displayColorFields.includes('Density')) lines.push(`Densidad: ${c.Density}`);
    const textToShare = lines.join('\n');

    try {
      await CapShare.share({
        title: 'Color Escaneado con Nix',
        text: textToShare,
        dialogTitle: 'Compartir Color',
      });
    } catch (err) {
      console.error('Error al compartir', err);
      // Fallback
      navigator.clipboard.writeText(textToShare);
      setSaveMessage({ type: 'success', text: 'Copiado al portapapeles' });
      setTimeout(() => setSaveMessage({ type: '', text: '' }), 3000);
    }
  };

  const [isGuardarEscaneoOpen, setIsGuardarEscaneoOpen] = useState(false);

  const handleSaveMeasurement = () => {
    if (!displayMeasurement) return;
    setIsGuardarEscaneoOpen(true);
  };

  const handleSaveSuccess = (savedMedicion: any) => {
    setSaveMessage({ type: 'success', text: '¡Medición guardada correctamente!' });
    setTimeout(() => setSaveMessage({ type: '', text: '' }), 3000);
  };


  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0F14] text-slate-900 dark:text-slate-200 font-sans flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 z-10 flex w-full items-center justify-between border-b border-black/10 bg-[#CC5200] shadow-lg px-4 py-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="p-2 text-white/70 hover:text-white transition-colors">
            <ArrowLeft className="h-6 w-6 text-white" />
          </button>
          <h1 className="text-lg font-semibold uppercase tracking-tight text-white">Escaneo único</h1>
        </div>

        <div className="flex items-center gap-1">
          {displayMeasurement && !isMeasuring && (
            <>
              <button
                onClick={handleShare}
                disabled={!historyMeasurement && settings.measurementTrigger === 'manual' && measurements.length < settings.multiPointAveraging}
                className="p-2 text-white/70 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Compartir"
              >
                <Share2 className="h-6 w-6 text-white" />
              </button>
              <button
                onClick={handleSaveMeasurement}
                disabled={isSaving || !!historyMeasurement || (!historyMeasurement && settings.measurementTrigger === 'manual' && measurements.length < settings.multiPointAveraging)}
                className="p-2 text-white/70 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Guardar"
              >
                {isSaving ? <RefreshCcw className="h-6 w-6 text-white animate-spin" /> : <Save className="h-6 w-6 text-white" />}
              </button>
            </>
          )}
          <button onClick={() => setIsHistorialOpen(true)} className="p-2 text-white/70 hover:text-white transition-colors">
            <History className="h-6 w-6 text-white" />
          </button>
          <button onClick={() => setIsDeviceSettingsOpen(true)} className="p-2 text-white/70 hover:text-white transition-colors">
            <Settings className="h-6 w-6 text-white" />
          </button>
        </div>
      </header>

      <DeviceSettings
        isOpen={isDeviceSettingsOpen}
        onClose={() => setIsDeviceSettingsOpen(false)}
        isConnected={isConnected}
        onSettingsChange={reloadSettings}
      />

      <main className="flex flex-col items-center pt-24 px-6 max-w-lg mx-auto w-full flex-grow">

        {/* Browser support alert */}
        {!isSupported && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 mb-6 w-full">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-900 dark:text-slate-300">
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
                ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                : 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20'
                }`}
            >
              <div className="flex justify-between items-center">
                <span>{error || saveMessage.text}</span>
                {error && <button onClick={clearError} className="underline uppercase tracking-widest text-[8px]">Cerrar</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isConnected && !isConnecting && !isScanning && !historyMeasurement ? (
          <div className="flex w-full flex-col items-center gap-8 text-center mt-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-64 w-full items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#a38105]/10 to-transparent"></div>
              <div className="relative">
                <Bluetooth className="h-16 w-16 text-[#d4af37]/40" />
                <div className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/50"></div>
              </div>
            </motion.div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Conecta tu dispositivo Nix</h2>
              <p className="mt-2 text-slate-600 dark:text-slate-500 text-sm">Coloca tu dispositivo Nix cerca de tu smartphone y presiona 'Conectar a Nix' para comenzar.</p>
            </div>
            <button
              onClick={() => navigate('/colorimetro', { state: { returnTo: '/scan', autoScan: true } })}
              disabled={!isSupported || isScanning || isConnecting}
              className="w-full rounded-lg bg-[#d4af37] hover:bg-[#e6c84d] py-4 font-bold text-slate-900 transition-all active:scale-95 shadow-lg shadow-[#a38105]/20 uppercase tracking-widest text-sm disabled:opacity-50 disabled:bg-slate-700"
            >
              {isScanning ? 'Buscando...' : 'Conectar a Nix'}
            </button>
          </div>
        ) : isConnecting ? (
          <div className="flex w-full flex-col items-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 shadow-2xl mt-12 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#a38105] to-[#d4af37]"></div>
            <h2 className="mb-8 text-xl font-bold text-slate-900 dark:text-white tracking-tight">Conectando a Nix</h2>
            <div className="space-y-6 w-full">
              <div className="flex items-center gap-4 text-sm">
                <div className="rounded-full bg-emerald-500/20 p-1"><Check className="h-4 w-4 text-emerald-500" /></div>
                <span className="text-slate-700 dark:text-slate-300">Dispositivo encontrado</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="h-6 w-6 rounded-full border-2 border-[#d4af37]/30 border-t-[#d4af37] animate-spin"></div>
                <span className="text-slate-900 dark:text-white font-medium">Sincronizando...</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-600 font-medium">
                <div className="w-6 h-6"></div>
                <span>Preparando interface...</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-6">
            {/* Device Info */}
            {isConnected && deviceInfo && (
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 shadow-md">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">{deviceInfo.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1">
                    <Battery className="w-4 h-4 text-slate-700 dark:text-slate-400" /> {deviceInfo.batteryLevel}%
                  </span>
                </div>
              </div>
            )}

            {/* Color Result Card */}
            <motion.div
              layoutId="color-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-48 sm:h-64 md:h-80 w-full rounded-3xl overflow-hidden shadow-2xl relative transition-all duration-500 ease-out"
              style={{ backgroundColor: displayMeasurement?.color.hex || '#ffffff' }}
            >

              {isMeasuring && !historyMeasurement && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#d4af37] border-t-transparent mb-4"></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#d4af37] animate-pulse">Capturando Datos</p>
                </div>
              )}

              {historyMeasurement && (
                <div className="absolute top-4 left-4">
                  <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#d4af37]/40">
                    <History className="h-3.5 w-3.5 text-[#d4af37]" />
                    <span className="text-[9px] font-bold text-white uppercase tracking-widest">Historial</span>
                    <button
                      onClick={() => setHistoryMeasurement(null)}
                      className="ml-1 p-0.5 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <X className="h-3 w-3 text-white/70" />
                    </button>
                  </div>
                </div>
              )}

              {displayMeasurement && !isMeasuring && (
                <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                  <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                    <span className="text-white font-mono font-bold tracking-tighter text-lg uppercase">
                      {displayMeasurement.color.hex}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>

            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></div>
                  {historyMeasurement ? (
                    <div className="min-w-0 max-w-[260px]">
                      <p className="text-slate-700 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest truncate">
                        {historyMeasurement.nombre || 'Medición'}
                      </p>
                      <p className="text-slate-500 dark:text-slate-500 text-[9px] uppercase font-bold tracking-widest truncate mt-0.5">
                        {historyMeasurement.blancoReferencia && <span>{historyMeasurement.blancoReferencia.replace('/', ', ')}</span>}
                        {historyMeasurement.modoMedicion && <span className="ml-1.5 opacity-60">· {historyMeasurement.modoMedicion}</span>}
                        {historyMeasurement.promedio && <span className="ml-1.5 opacity-60">· ø{historyMeasurement.promedio}</span>}
                      </p>
                    </div>
                  ) : isAverageMode ? (
                    <p className="text-slate-700 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                      <span className="text-[#d4af37] font-extrabold">Promedio</span> · {settings.referenceWhite.replace('/', ', ')} · {settings.measurementMode}
                    </p>
                  ) : (
                    <p className="text-slate-700 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                      {settings.referenceWhite.replace('/', ', ')} · {settings.measurementMode}
                      {settings.densityStatus !== 'ISO Status T' && ` · ${settings.densityStatus}`}

                    </p>
                  )}
                  {dE !== null && !historyMeasurement && (
                    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-700 dark:text-slate-400">ΔE:</span>
                      <span className={`text-[10px] font-bold ${dE < 1.0 ? 'text-green-600 dark:text-green-400' : dE < 2.5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                        {dE.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
                {displayMeasurement && (
                  <p className="text-slate-700 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                    {historyMeasurement
                      ? new Date(displayMeasurement.timestamp).toLocaleString()
                      : new Date(displayMeasurement.timestamp).toLocaleTimeString()
                    }
                  </p>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-200 dark:divide-slate-800/50 shadow-inner overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-[#a38105] to-[#d4af37]"></div>
                {settings.displayColorFields.includes('CIELAB') && (
                  <div className="px-5 py-4 flex justify-between items-center transition-all hover:bg-slate-100 dark:hover:bg-slate-800/30 hover:translate-x-1">
                    <span className="text-slate-700 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">CIELAB</span>
                    <span className="font-mono text-base text-slate-900 dark:text-white">
                      {displayMeasurement ? `${fmt(displayMeasurement.color.L)}, ${fmt(displayMeasurement.color.a)}, ${fmt(displayMeasurement.color.b)}` : '--'}
                    </span>
                  </div>
                )}
                {settings.displayColorFields.includes('sRGB') && (
                  <div className="px-5 py-4 flex justify-between items-center transition-all hover:bg-slate-100 dark:hover:bg-slate-800/30 hover:translate-x-1">
                    <span className="text-slate-700 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">sRGB</span>
                    <span className="font-mono text-base text-slate-900 dark:text-white uppercase">
                      {displayMeasurement ? `${displayMeasurement.color.R}, ${displayMeasurement.color.G}, ${displayMeasurement.color.B}` : '--'}
                    </span>
                  </div>
                )}
                {settings.displayColorFields.includes('LCH(ab)') && (
                  <div className="px-5 py-4 flex justify-between items-center transition-all hover:bg-slate-100 dark:hover:bg-slate-800/30 hover:translate-x-1">
                    <span className="text-slate-700 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">LCH(ab)</span>
                    <span className="font-mono text-base text-slate-900 dark:text-white">
                      {displayMeasurement ? `${fmt(displayMeasurement.color.L)}, ${fmt(displayMeasurement.color.C)}, ${fmt(displayMeasurement.color.H)}°` : '--'}
                    </span>
                  </div>
                )}
                {settings.displayColorFields.includes('HTX') && (
                  <div className="px-5 py-4 flex justify-between items-center transition-all hover:bg-slate-100 dark:hover:bg-slate-800/30 hover:translate-x-1">
                    <span className="text-slate-700 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">HEX</span>
                    <span className="font-mono text-base text-slate-900 dark:text-white uppercase">
                      {displayMeasurement ? displayMeasurement.color.hex : '--'}
                    </span>
                  </div>
                )}
                {settings.displayColorFields.includes('CIEXYZ') && (
                  <div className="px-5 py-4 flex justify-between items-center transition-all hover:bg-slate-100 dark:hover:bg-slate-800/30 hover:translate-x-1">
                    <span className="text-slate-700 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">CIEXYZ</span>
                    <span className="font-mono text-base text-slate-900 dark:text-white">
                      {displayMeasurement ? `${fmt(displayMeasurement.color.X)}, ${fmt(displayMeasurement.color.Y)}, ${fmt(displayMeasurement.color.Z)}` : '--'}
                    </span>
                  </div>
                )}
                {settings.displayColorFields.includes('CMYK') && (
                  <div className="px-5 py-4 flex justify-between items-center transition-all hover:bg-slate-100 dark:hover:bg-slate-800/30 hover:translate-x-1">
                    <span className="text-slate-700 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">CMYK</span>
                    <span className="font-mono text-base text-slate-900 dark:text-white">
                      {displayMeasurement ? `${fmt(displayMeasurement.color.cmyk.C)}%, ${fmt(displayMeasurement.color.cmyk.M)}%, ${fmt(displayMeasurement.color.cmyk.Y)}%, ${fmt(displayMeasurement.color.cmyk.K)}%` : '--'}
                    </span>
                  </div>
                )}
                {(settings.displayColorFields.includes('LRV') || settings.displayColorFields.includes('Density')) && (
                  <div className="px-5 py-4 flex justify-between items-center transition-all hover:bg-slate-100 dark:hover:bg-slate-800/30 hover:translate-x-1">
                    <span className="text-slate-700 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">EXT</span>
                    <span className="font-mono text-base text-slate-900 dark:text-white">
                      {displayMeasurement
                        ? [
                          ...(settings.displayColorFields.includes('LRV') ? [`LRV: ${displayMeasurement.color.LRV}`] : []),
                          ...(settings.displayColorFields.includes('Density') ? [`Dens: ${displayMeasurement.color.Density}`] : []),
                        ].join(' · ')
                        : '--'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {settings.measurementTrigger === 'manual' && measurements.length > 0 && (
              <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4 text-slate-700 dark:text-slate-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-400">Historial</span>
                    <span className="text-[10px] font-bold text-[#d4af37]">{measurements.length} medida{measurements.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {[...measurements].reverse().map((m, idx) => {
                    const num = measurements.length - idx;
                    return (
                      <div key={m.timestamp} className="flex items-stretch gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 last:border-b-0 hover:bg-slate-100 dark:hover:bg-slate-800/30 transition-colors">
                        <div
                          className="w-14 h-14 rounded-xl flex-shrink-0 border border-slate-200 dark:border-slate-700 shadow-inner"
                          style={{ backgroundColor: m.color.hex }}
                        />
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-[#d4af37] uppercase tracking-widest">Medida #{num}</span>
                              <button
                                onClick={() => setPendingDelete({ timestamp: m.timestamp, num })}
                                className="p-0.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                title="Eliminar medida"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-[9px] text-slate-500 dark:text-slate-500 font-mono">
                              {new Date(m.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-mono flex-wrap mt-1">
                            {settings.displayColorFields.includes('HTX') && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold uppercase tracking-wider" style={{ color: m.color.hex }}>{m.color.hex}</span>
                            )}
                            {settings.displayColorFields.includes('CIELAB') && (
                              <span>L*{fmt(m.color.L)} a*{fmt(m.color.a)} b*{fmt(m.color.b)}</span>
                            )}
                            {settings.displayColorFields.includes('sRGB') && (
                              <span>RGB {m.color.R},{m.color.G},{m.color.B}</span>
                            )}
                            {settings.displayColorFields.includes('LCH(ab)') && (
                              <span>LCH {fmt(m.color.L)},{fmt(m.color.C)},{fmt(m.color.H)}°</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                disabled={isMeasuring || !!historyMeasurement || (settings.measurementTrigger === 'manual' && measurements.length >= settings.multiPointAveraging)}
                onClick={measure}
                className="flex-[2] flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#e6c84d] hover:from-[#e6c84d] hover:to-[#f0d860] py-5 font-bold text-slate-900 transition-all active:scale-95 disabled:bg-slate-700 disabled:text-slate-400 group overflow-hidden relative shadow-xl shadow-[#a38105]/20"
              >
                {isMeasuring ? (
                  <RefreshCcw className="h-5 w-5 animate-spin" />
                ) : (
                  <ScanIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
                )}
                <span className="uppercase tracking-widest text-xs font-extrabold">
                  {isMeasuring
                    ? 'Procesando...'
                    : historyMeasurement
                      ? 'Medida guardada'
                      : settings.measurementTrigger === 'manual'
                        ? `Medida ${Math.min(measurements.length + 1, settings.multiPointAveraging)}/${settings.multiPointAveraging}`
                        : 'Escanear con Nix'
                  }
                </span>
              </button>

              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-slate-600/10 hover:bg-slate-600/20 border border-slate-600/20 py-5 text-slate-400 hover:text-slate-300 transition-all active:scale-95"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="p-6 text-center">
        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-[0.2em]">
          {status} {deviceInfo?.serialNumber ? `· S/N: ${deviceInfo.serialNumber}` : ''}
        </p>
      </footer>
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
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Eliminar Medida #{pendingDelete.num}</h3>
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
                      removeMeasurement(pendingDelete.timestamp);
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
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Reiniciar mediciones</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                  {measurements.length > 0
                    ? `Tienes ${measurements.length} medición${measurements.length !== 1 ? 'es' : ''} sin guardar. Se perderán todos los datos. ¿Deseas continuar?`
                    : '¿Cerrar la actual visualización de medición?'}
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
                      setHistoryMeasurement(null);
                      setShowClearConfirm(false);
                    }}
                    className="flex-1 px-6 py-3 rounded-xl bg-[#D4672A] hover:bg-[#D4672A]/80 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                  >
                    Reiniciar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <GuardarEscaneo
        isOpen={isGuardarEscaneoOpen}
        onClose={() => setIsGuardarEscaneoOpen(false)}
        measurement={displayMeasurement}
        onSaveSuccess={handleSaveSuccess}
        onLogout={onLogout}
        blancoReferencia={settings.referenceWhite}
        modoMedicion={settings.measurementMode}
        densidad={settings.densityStatus}
        promedio={isAverageMode ? measurements.length : settings.multiPointAveraging}
      />
      <HistorialMediciones
        isOpen={isHistorialOpen}
        onClose={() => setIsHistorialOpen(false)}
        onSelectMeasurement={handleSelectMeasurement}
      />
    </div>
  );
}
