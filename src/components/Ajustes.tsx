import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sun, Moon, Monitor, Palette, FileText } from 'lucide-react';
import ScreenBrightness from '../services/ScreenBrightness';
import FichasBases from './FichasBases';

interface AjustesProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDeltaRango: () => void;
}

export default function Ajustes({ isOpen, onClose, onOpenDeltaRango }: AjustesProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
  });
  const [maxBrightness, setMaxBrightness] = useState(() => {
    return localStorage.getItem('maxBrightness') === 'true';
  });
  const [showFichasBases, setShowFichasBases] = useState(false);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (maxBrightness) {
      ScreenBrightness.setBrightness({ brightness: 1 });
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(r => { wakeLockRef.current = r; }).catch(() => {});
      }
    } else {
      ScreenBrightness.setBrightness({ brightness: -1 });
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    }
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, [maxBrightness]);

  const changeTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(newTheme);
    localStorage.setItem('theme', newTheme);
    window.dispatchEvent(new Event('theme-change'));
  };

  const toggleBrightness = () => {
    const next = !maxBrightness;
    setMaxBrightness(next);
    localStorage.setItem('maxBrightness', String(next));
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-full max-w-[300px] bg-[#0A0F14] border-r border-slate-800 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-5 bg-[var(--accent-orange)] shadow-md">
                <h2 className="text-xs font-bold text-white uppercase tracking-widest">Ajustes globales</h2>
                <button onClick={onClose} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-6 space-y-6 px-6">
                {/* Theme */}
                <section>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                    Tema de la app
                  </span>
                  <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800/80 gap-1">
                    <button
                      onClick={() => changeTheme('light')}
                      className={`flex-grow flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        theme === 'light'
                          ? 'bg-[var(--accent-orange)] text-white shadow-lg shadow-orange-950/20'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                      }`}
                    >
                      <Sun className="h-4 w-4" />
                      Claro
                    </button>
                    <button
                      onClick={() => changeTheme('dark')}
                      className={`flex-grow flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        theme === 'dark'
                          ? 'bg-[#002C6C] text-white shadow-lg shadow-blue-950/20'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                      }`}
                    >
                      <Moon className="h-4 w-4" />
                      Oscuro
                    </button>
                  </div>
                </section>

                {/* Brightness */}
                <section>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                    Brillo máximo de pantalla
                  </span>
                  <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <Monitor className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-300">Activar</span>
                    </div>
                    <button
                      onClick={toggleBrightness}
                      className={`relative w-14 h-7 rounded-full transition-all cursor-pointer ${
                        maxBrightness ? 'bg-[#002C6C]' : 'bg-slate-700'
                      }`}
                    >
                      <motion.div
                        initial={false}
                        animate={{ x: maxBrightness ? 28 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1.5 leading-relaxed">
                    {maxBrightness
                      ? 'La pantalla permanecerá encendida al máximo brillo.'
                      : 'Se usará el brillo actual del dispositivo.'}
                  </p>
                </section>

                {/* Delta Ranges + Fichas */}
                <section>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                    Rangos de Delta
                  </span>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenDeltaRango();
                    }}
                    className="w-full flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-800/80 hover:bg-slate-800/30 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Palette className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-300">Configurar Rangos</span>
                    </div>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Abrir</span>
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      setShowFichasBases(true);
                    }}
                    className="w-full flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-800/80 hover:bg-slate-800/30 transition-all cursor-pointer mt-2"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-300">Fichas técnicas</span>
                    </div>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Abrir</span>
                  </button>
                </section>
              </div>

              <div className="p-6 border-t border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Versión de la app 1.8.9 (build 392)</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <FichasBases
        isOpen={showFichasBases}
        onClose={() => setShowFichasBases(false)}
      />
    </>
  );
}
