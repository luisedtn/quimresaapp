import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Scan, RefreshCcw, Check, RotateCcw, Bluetooth } from 'lucide-react';
import { useNixDevice } from '../hooks/useNixDevice';
import { useNavigate } from 'react-router-dom';

interface EscaneoQCResult {
  l: number;
  a: number;
  b: number;
  hex: string;
  name: string;
}

interface EscaneoQCProps {
  mode: 'standard' | 'sample';
  onClose: () => void;
  onConfirm: (result: EscaneoQCResult) => void;
  currentStandard?: any;
  currentSample?: any;
}

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

export default function EscaneoQC({ mode, onClose, onConfirm, currentStandard, currentSample }: EscaneoQCProps) {
  const navigate = useNavigate();
  const {
    isConnected,
    isMeasuring,
    measurements,
    settings,
    measure,
    clearMeasurements,
    error,
    clearError,
    deviceInfo,
  } = useNixDevice();

  const [localMeasurements, setLocalMeasurements] = useState<any[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  // Clean device measurements on open
  useEffect(() => {
    clearMeasurements();
    setLocalMeasurements([]);
  }, []);

  // Track new device measurements into local list
  const prevMeasurementsLengthRef = useState<number>(0);
  useEffect(() => {
    if (measurements.length > 0) {
      setLocalMeasurements(prev => {
        const combined = [...measurements, ...prev];
        // deduplicate by timestamp
        const seen = new Set<string>();
        const unique = combined.filter(m => {
          if (seen.has(m.timestamp)) return false;
          seen.add(m.timestamp);
          return true;
        });
        return unique.slice(0, settings.multiPointAveraging);
      });
    }
  }, [measurements.length]);

  const target = settings.measurementTrigger === 'manual' ? settings.multiPointAveraging : 1;
  const captured = localMeasurements.length;
  const isComplete = captured >= target;

  const averageResult = useMemo<EscaneoQCResult | null>(() => {
    if (localMeasurements.length === 0) return null;
    const n = localMeasurements.length;
    const avgL = localMeasurements.reduce((s, m) => s + m.color.L, 0) / n;
    const avgA = localMeasurements.reduce((s, m) => s + m.color.a, 0) / n;
    const avgB = localMeasurements.reduce((s, m) => s + m.color.b, 0) / n;
    // Use hex from the most recent single measure (or compute from LAB average)
    const hex = n === 1 ? (localMeasurements[0].color.hex ?? labToHex(avgL, avgA, avgB)) : labToHex(avgL, avgA, avgB);
    return {
      l: avgL,
      a: avgA,
      b: avgB,
      hex,
      name: mode === 'standard' ? 'Patrón (Promedio)' : 'Muestra (Promedio)',
    };
  }, [localMeasurements, mode]);

  const handleCapture = async () => {
    if (!isConnected) {
      navigate('/colorimetro', {
        state: {
          returnTo: '/quality-control',
          escaneoMode: mode,
          standardFromQC: currentStandard,
          sampleFromQC: currentSample,
        }
      });
      return;
    }
    if (isComplete) return;
    setIsCapturing(true);
    await measure();
    setIsCapturing(false);
  };

  const handleReset = () => {
    clearMeasurements();
    setLocalMeasurements([]);
  };

  const handleConfirm = () => {
    if (!averageResult) return;
    onConfirm(averageResult);
    clearMeasurements();
  };

  const modeLabel = mode === 'standard' ? 'Patrón' : 'Muestra';
  const previewHex = averageResult?.hex ?? '#334155';

  const fmt = (v: number) => v.toFixed(2);

  const progressPct = target > 0 ? Math.min((captured / target) * 100, 100) : 0;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel slides up from bottom */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#0e1621] rounded-t-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Top accent line */}
        <div className="h-1 w-full bg-[#CC5200]" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-extrabold uppercase tracking-tight text-slate-900 dark:text-white">
              Escanear {modeLabel}
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-widest mt-0.5">
              {settings.referenceWhite.replace('/', ', ')} · {settings.measurementMode}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-xs font-semibold"
              >
                <span>{error}</span>
                <button onClick={clearError} className="underline uppercase tracking-widest text-[9px]">Cerrar</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Color Preview Card */}
          <motion.div
            className="relative w-full h-36 rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800"
            animate={{ backgroundColor: previewHex }}
            transition={{ duration: 0.5 }}
            style={{ backgroundColor: previewHex }}
          >
            {/* Overlay shimmer when measuring */}
            {(isMeasuring || isCapturing) && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#CC5200] border-t-transparent" style={{ borderWidth: 3 }} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#CC5200] animate-pulse">Capturando...</p>
              </div>
            )}

            {/* Empty state */}
            {!averageResult && !isMeasuring && !isCapturing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-100 dark:bg-slate-900">
                <Scan className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Sin lecturas</p>
              </div>
            )}

            {/* HEX badge */}
            {averageResult && !isMeasuring && !isCapturing && (
              <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                <span className="font-mono font-bold text-white tracking-tighter text-sm uppercase">
                  {averageResult.hex}
                </span>
              </div>
            )}

            {/* Complete badge */}
            {isComplete && !isMeasuring && !isCapturing && (
              <div className="absolute top-3 right-3 bg-green-600/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1.5 border border-green-400/30">
                <Check className="w-3.5 h-3.5 text-white" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Completo</span>
              </div>
            )}

            {/* Device info badge */}
            {isConnected && deviceInfo && (
              <div className="absolute top-3 left-3 bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-white/10">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] font-bold text-white uppercase tracking-widest">{deviceInfo.name}</span>
              </div>
            )}
          </motion.div>

          {/* Not connected state */}
          {!isConnected && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
              <Bluetooth className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Dispositivo desconectado. Al escanear, será redirigido al Colorímetro para conectarse.
              </p>
            </div>
          )}

          {/* Progress Section */}
          {settings.measurementTrigger === 'manual' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Progreso de lecturas
                </span>
                <span className="text-[11px] font-extrabold text-slate-800 dark:text-white tabular-nums">
                  {captured} / {target}
                </span>
              </div>
              {/* Progress Bar */}
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-[#CC5200]"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
              {/* Dots indicator */}
              <div className="flex gap-1.5 mt-1">
                {Array.from({ length: target }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                      i < captured ? 'bg-[#CC5200]' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* LAB Average Result */}
          {averageResult && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 overflow-hidden"
            >
              <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                  {captured > 1 ? `Promedio (${captured} lecturas)` : 'Lectura'}
                </span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-700">
                {[
                  { label: 'L*', value: fmt(averageResult.l), color: 'text-amber-600 dark:text-[#d4af37]' },
                  { label: 'a*', value: fmt(averageResult.a), color: 'text-red-600 dark:text-red-400' },
                  { label: 'b*', value: fmt(averageResult.b), color: 'text-blue-600 dark:text-blue-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col items-center py-3 gap-0.5">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{label}</span>
                    <span className="text-base font-mono font-bold text-slate-800 dark:text-white tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Individual measurements list (manual mode) */}
          {settings.measurementTrigger === 'manual' && localMeasurements.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Lecturas individuales</span>
              </div>
              {localMeasurements.map((m, idx) => (
                <div
                  key={m.timestamp}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex-shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm"
                    style={{ backgroundColor: m.color.hex }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold text-[#CC5200] uppercase tracking-widest">Medida #{localMeasurements.length - idx}</p>
                    <p className="font-mono text-xs text-slate-700 dark:text-slate-300 tracking-tight">
                      L*{fmt(m.color.L)} &nbsp;a*{fmt(m.color.a)} &nbsp;b*{fmt(m.color.b)}
                    </p>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                    {new Date(m.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>{/* end scrollable */}

        {/* Bottom Actions */}
        <div className="px-5 pt-3 pb-6 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-white dark:bg-[#0e1621]">

          {/* Main action row */}
          <div className="flex gap-3">
            {/* Reset */}
            <button
              onClick={handleReset}
              disabled={captured === 0 || isMeasuring || isCapturing}
              className="w-14 h-14 flex-shrink-0 rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Reiniciar lecturas"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Scan button */}
            {!isComplete ? (
              <motion.button
                whileHover={!isMeasuring && !isCapturing ? { y: -2, scale: 1.02 } : {}}
                whileTap={!isMeasuring && !isCapturing ? { scale: 0.97 } : {}}
                onClick={handleCapture}
                disabled={isMeasuring || isCapturing}
                className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#CC5200] hover:bg-[#b84900] text-white font-bold uppercase tracking-widest shadow-[0_8px_30px_rgba(204,82,0,0.35)] border border-[#CC5200]/50 disabled:opacity-60 disabled:cursor-not-allowed transition-all text-sm"
              >
                {isMeasuring || isCapturing ? (
                  <RefreshCcw className="w-5 h-5 animate-spin" />
                ) : (
                  <Scan className="w-5 h-5" />
                )}
                {isMeasuring || isCapturing
                  ? 'Capturando...'
                  : settings.measurementTrigger === 'manual'
                    ? `Medida ${Math.min(captured + 1, target)} / ${target}`
                    : `Escanear ${modeLabel}`
                }
              </motion.button>
            ) : (
              /* Confirm button when complete */
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-widest shadow-[0_8px_30px_rgba(22,163,74,0.3)] border border-green-500/50 transition-all text-sm"
              >
                <Check className="w-5 h-5" />
                Usar como {modeLabel}
              </motion.button>
            )}
          </div>

          {/* Hint text */}
          <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-medium">
            {isComplete
              ? 'Confirma para cargar los valores promediados en el Control de Calidad'
              : settings.measurementTrigger === 'manual'
                ? `Captura ${target} medida${target !== 1 ? 's' : ''} para calcular el promedio`
                : `Presiona Escanear para capturar el ${modeLabel}`
            }
          </p>
        </div>
      </motion.div>
    </div>
  );
}
