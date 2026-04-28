import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Settings, Bluetooth, Check, RefreshCcw, Scan as ScanIcon } from 'lucide-react';

interface ScanProps {
  userData?: any;
}

export default function Scan({ userData }: ScanProps) {
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const simulateScan = async () => {
    setIsScanning(true);
    // Simulate spectral capture
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockResult = {
      cielab: '67.45, 5.33, 47.99',
      hex: '#c0a04b',
      srgb: '192, 160, 75',
      deviceName: 'Nix Spectro Mini',
      timestamp: new Date().toISOString()
    };

    setResult(mockResult);
    setIsScanning(false);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    await new Promise(resolve => setTimeout(resolve, 3000));
    setConnected(true);
    setIsConnecting(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0F14] text-slate-200 font-sans flex flex-col">
      {/* Header */}
      <header className="fixed top-0 z-10 flex w-full items-center justify-between border-b border-slate-800 bg-[#0A0F14]/80 backdrop-blur-md px-4 py-4">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold uppercase tracking-tight">Escaneo único</h1>
        <button className="p-2 text-slate-400 hover:text-white transition-colors">
          <Settings className="h-6 w-6" />
        </button>
      </header>

      <main className="flex flex-col items-center pt-24 px-6 max-w-lg mx-auto w-full flex-grow">
        {!connected && !isConnecting ? (
          <div className="flex w-full flex-col items-center gap-8 text-center mt-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-64 w-full items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-transparent"></div>
              <div className="relative">
                <Bluetooth className="h-16 w-16 text-blue-400" />
                <div className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50 animate-pulse"></div>
              </div>
            </motion.div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Conecta tu dispositivo Nix</h2>
              <p className="mt-2 text-slate-500 text-sm">Coloca tu dispositivo Nix cerca de tu smartphone y presiona 'Conectar a Nix' para comenzar.</p>
            </div>
            <button
              onClick={handleConnect}
              className="w-full rounded-lg bg-[#004A99] hover:bg-blue-600 py-4 font-bold transition-all active:scale-95 shadow-lg shadow-blue-900/20 uppercase tracking-widest text-sm"
            >
              Conectar a Nix
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
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <div className="w-6 h-6"></div>
                <span>Probando luces...</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <div className="w-6 h-6"></div>
                <span>Verificando batería...</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-6">
            {/* Color Result Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-80 w-full rounded-2xl overflow-hidden shadow-2xl relative border-4 border-slate-900"
              style={{ backgroundColor: result?.hex || '#1a1a1a' }}
            >
              <div className="absolute top-4 right-4 flex gap-2">
                <div className="px-2 py-1 bg-black/30 backdrop-blur-md rounded text-[10px] font-bold text-white/70 tracking-widest uppercase">
                  Modo Espectral
                </div>
              </div>

              {isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mb-4"></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-400 animate-pulse">Capturando Datos</p>
                </div>
              )}
            </motion.div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Iluminante: D50, Observador: 2°, M2</p>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 divide-y divide-slate-800">
                <div className="py-4 flex justify-between items-center">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">CIELAB</span>
                  <span className="font-mono text-lg text-white">{result?.cielab || '--'}</span>
                </div>
                <div className="py-4 flex justify-between items-center">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">HEX</span>
                  <span className="font-mono text-lg text-white uppercase">{result?.hex || '--'}</span>
                </div>
                <div className="py-4 flex justify-between items-center">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">sRGB</span>
                  <span className="font-mono text-lg text-white">{result?.srgb || '--'}</span>
                </div>
              </div>
            </div>

            <button
              disabled={isScanning}
              onClick={simulateScan}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-white hover:bg-slate-200 py-4 font-bold text-black transition-all active:scale-95 disabled:bg-slate-700 disabled:text-slate-400 group overflow-hidden relative shadow-xl shadow-white/5"
            >
              {isScanning ? (
                <RefreshCcw className="h-5 w-5 animate-spin" />
              ) : (
                <ScanIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
              )}
              <span className="uppercase tracking-widest text-sm">
                {isScanning ? 'Procesando...' : 'Escanear con Nix'}
              </span>
            </button>
          </div>
        )}
      </main>

      <footer className="p-6 text-center">
        <p className="text-[10px] text-slate-600 uppercase tracking-widest">NIX SPECTRO MINI S/N: 9827-XJ</p>
      </footer>
    </div>
  );
}
