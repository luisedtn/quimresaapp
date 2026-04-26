import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Check, X, Info } from 'lucide-react';

export default function QualityControl() {
  const navigate = useNavigate();
  const [standard, setStandard] = useState<any>(null);
  const [sample, setSample] = useState<any>(null);

  const mockStandard = {
    l: 67.45,
    a: 5.34,
    b: 47.99,
    hex: '#c0a04b',
    name: 'Andean Studio (Standard)'
  };

  const mockSample = {
    l: 68.12,
    a: 5.45,
    b: 46.88,
    hex: '#c5a552',
    name: 'Muestra 1'
  };

  const handleCaptureStandard = () => setStandard(mockStandard);
  const handleCaptureSample = () => setSample(mockSample);

  const calculateDeltaE = () => {
    if (!standard || !sample) return null;
    const dL = sample.l - standard.l;
    const dA = sample.a - standard.a;
    const dB = sample.b - standard.b;
    return Math.sqrt(dL * dL + dA * dA + dB * dB).toFixed(2);
  };

  const deltaE = calculateDeltaE();
  const isPass = deltaE !== null && parseFloat(deltaE) < 1.0;

  return (
    <div className="min-h-screen bg-[#0A0F14] text-slate-200 font-sans flex flex-col">
      <header className="fixed top-0 z-10 flex w-full items-center justify-between border-b border-slate-800 bg-[#0A0F14]/80 backdrop-blur-md px-4 py-4">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold uppercase tracking-tight">Control de calidad</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex flex-col gap-6 pt-24 pb-8 px-4 max-w-lg mx-auto w-full flex-grow">
        {/* Standard Selection */}
        <div className="flex flex-col gap-2">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Estándar de Laboratorio</h2>
          <motion.div 
            whileHover={{ backgroundColor: 'rgba(30, 41, 59, 0.3)' }}
            onClick={handleCaptureStandard}
            className="flex items-center gap-4 rounded-xl border border-slate-800 p-4 transition-all hover:border-slate-600 bg-slate-900/50 cursor-pointer group"
          >
            <div className="h-16 w-16 rounded-lg shadow-2xl border-2 border-slate-800 group-hover:border-slate-700 transition-colors" style={{ backgroundColor: standard?.hex || '#1a1a1a' }}></div>
            <div className="flex-1">
               <p className="font-bold text-sm text-white">{standard?.name || 'Tocar para escanear estándar'}</p>
               {standard ? (
                 <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter italic">L: {standard.l} | a: {standard.a} | b: {standard.b}</p>
               ) : (
                 <p className="text-xs text-slate-600">Seleccionar color de referencia</p>
               )}
            </div>
            {!standard && <div className="rounded-full bg-[#004A99] p-2 shadow-lg shadow-blue-500/20"><Check className="h-4 w-4 text-white" /></div>}
          </motion.div>
        </div>

        {/* Sample Selection */}
        <div className="flex flex-col gap-2">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Muestra Actual</h2>
          <motion.div 
            whileHover={{ backgroundColor: 'rgba(30, 41, 59, 0.3)' }}
            onClick={handleCaptureSample}
            className="flex items-center gap-4 rounded-xl border border-slate-800 p-4 transition-all hover:border-slate-600 bg-slate-900/50 cursor-pointer group"
          >
            <div className="h-16 w-16 rounded-lg shadow-2xl border-2 border-slate-800 group-hover:border-slate-700 transition-colors" style={{ backgroundColor: sample?.hex || '#1a1a1a' }}></div>
            <div className="flex-1">
               <p className="font-bold text-sm text-white">{sample?.name || 'Tocar para escanear muestra'}</p>
               {sample ? (
                 <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter italic">L: {sample.l} | a: {sample.a} | b: {sample.b}</p>
               ) : (
                 <p className="text-xs text-slate-600">Ingresar datos de muestra</p>
               )}
            </div>
            {!sample && <div className="rounded-full bg-[#004A99] p-2 shadow-lg shadow-blue-500/20"><Check className="h-4 w-4 text-white" /></div>}
          </motion.div>
        </div>

        {/* Results */}
        {deltaE && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`mt-4 rounded-2xl p-8 text-center shadow-2xl overflow-hidden relative ${isPass ? 'bg-emerald-900/10 border border-emerald-500/30' : 'bg-red-900/10 border border-red-500/30'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
            <div className="relative">
              <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full shadow-lg ${isPass ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'}`}>
                {isPass ? <Check className="h-10 w-10 text-white" /> : <X className="h-10 w-10 text-white" />}
              </div>
              <h3 className={`text-4xl font-black italic tracking-tighter ${isPass ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPass ? 'APROBADO' : 'RECHAZADO'}
              </h3>
              <div className="mt-4 flex items-center justify-center gap-3">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-widest italic">Alerta de Tolerancia:</span>
                <span className="text-2xl font-mono font-bold text-white">ΔE {deltaE}</span>
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest border-t border-slate-800 pt-4">
                 <Info className="h-3 w-3 text-blue-500" />
                 <p>Protocolo: CMC 2:1 | Límite Estándar: ΔE 1.0</p>
              </div>
            </div>
          </motion.div>
        )}

        <button
           className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 py-4 font-bold text-slate-400 transition-all active:scale-95 text-xs uppercase tracking-widest"
           onClick={() => { setStandard(null); setSample(null); }}
        >
          Limpiar Sesión
        </button>
      </main>
    </div>
  );
}
