import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  Power,
  Users,
  Pipette,
  ChevronRight
} from 'lucide-react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import Sidebar from '../components/Sidebar';
import { useNixDevice } from '../hooks/useNixDevice';
import HistorialControl from '../components/HistorialControl';
import CustomerSearch from '../components/CustomerSearch';
import LocalizacionClientes from '../components/LocalizacionClientes';
import Colorimetria from '../components/Colorimetria';
import ConsumoProyectos from '../components/ConsumoProyectos';

import IconoAjustes from '../assets/iconSpectro.svg';

interface DashboardProps {
  userData: any;
  onLogout: () => void;
  onUserDataChange: (data: any) => void;
}

type ActiveView = 'main' | 'colorimetria' | 'consumoproyectos';

export default function Dashboard({ userData, onLogout, onUserDataChange }: DashboardProps) {
  const navigate = useNavigate();
  const { isConnected, deviceInfo } = useNixDevice();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showHistorialControl, setShowHistorialControl] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showLocalizacion, setShowLocalizacion] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Control de vista: 'main' muestra los dos contenedores, 'colorimetria' o 'consumoproyectos'
  const [activeView, setActiveView] = useState<ActiveView>('main');

  useEffect(() => {
    console.log("[DEBUG] Dashboard userData:", userData);
  }, [userData]);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const headers: any = { 'Authorization': `Bearer ${token}` };
        if (userData?.idcliente) {
          headers['x-client-id'] = userData.idcliente.toString();
        }

        const res = await fetch(`${API_BASE_URL}/api/cliente`, {
          headers
        });
        if (res.ok) {
          const data = await res.json();
          if (data.LOGO) {
            setLogoUrl(data.LOGO);
          }
        }
      } catch (err) {
        console.error("Error fetching logo:", err);
      }
    };
    fetchLogo();
  }, []);

  const handleExitApp = () => {
    if (Capacitor.isNativePlatform()) {
      App.exitApp();
    } else {
      window.close();
    }
  };

  const handleSelectClient = (cliente: any) => {
    const updatedUserData = {
      ...userData,
      idcliente: cliente.CODIGO,
      empresa: cliente.NOMBRE,
      logoUrl: cliente.LOGO || userData.logoUrl,
      issuper: cliente.issuper !== undefined ? cliente.issuper : userData?.issuper
    };
    localStorage.setItem('userData', JSON.stringify(updatedUserData));
    onUserDataChange(updatedUserData);
    setShowCustomerSearch(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0F14] text-slate-200 font-sans flex flex-col overflow-x-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={onLogout}
        userData={userData}
      />

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExitConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Power className="w-32 h-32 text-white" />
              </div>
              <div className="relative">
                <h3 className="text-xl font-bold text-white mb-2 tracking-tight">¿Salir de la aplicación?</h3>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                  Estás a punto de cerrar el laboratorio de color de Quimresa. ¿Deseas continuar?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowExitConfirm(false)}
                    className="flex-1 px-6 py-3 rounded-xl bg-[var(--accent-orange)] hover:bg-[var(--accent-orange-hover)] text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleExitApp}
                    className="flex-1 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-red-900/20"
                  >
                    Salir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top Navigation / Header */}
      <header className="fixed top-0 z-10 flex w-full items-center justify-between border-b border-black/10 bg-[#CC5200] shadow-lg px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-black hover:text-white transition-colors hover:bg-black/10 rounded-lg"
          >
            <Menu className="h-6 w-6 text-white" />
          </button>
          {!(userData && (userData.typeuser == 0 || userData.typeuser === "0")) && (
            <div className="w-10 h-10 bg-black/20 overflow-hidden rounded flex items-center justify-center font-bold text-white text-xl shadow-lg">
              {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : 'Q'}
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white uppercase leading-none">{userData?.empresa || 'Quimresa'}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <p className="text-[10px] text-white/70"><span className="text-white/90 uppercase tracking-wider">Quimresa Color Lab</span></p>
            </div>
            {isConnected && deviceInfo && (
              <p className="text-[9px] text-white/60 mt-0.5 truncate max-w-[180px]" title={deviceInfo.name}>
                {deviceInfo.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col text-right mr-2">
            <p className="text-xs font-medium text-white">{userData?.email || 'usuario@quimresa.com'}</p>
            <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Acceso Autorizado</p>
          </div>
          {(userData && (userData.typeuser == 0 || userData.typeuser === "0")) && (
            <button
              onClick={() => setShowCustomerSearch(true)}
              className="p-2 text-black hover:text-white transition-colors bg-black/10 rounded-lg"
              title="Seleccionar Cliente"
            >
              <Users className="h-5 w-5 text-white" />
            </button>
          )}
          <button
            onClick={() => navigate('/colorimetro')}
            className="p-2 text-black hover:text-white transition-colors bg-black/10 rounded-lg"
            title="Colorímetro y Escáner"
          >
            <img src={IconoAjustes} alt="Icono" className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowExitConfirm(true)}
            className="p-2 text-black hover:text-white transition-colors bg-black/10 rounded-lg"
            title="Salir de la aplicación"
          >
            <Power className="h-5 w-5 text-white" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-8 flex-grow">
        {activeView === 'main' && (
          <div className="px-6 mb-12">
            <div className="mb-8">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Módulos Principales</h2>
              <p className="text-sm text-slate-400">Selecciona el módulo de trabajo que deseas abrir:</p>
            </div>

            {/* Dos contenedores principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {/* Contenedor 1: COLORIMETRÍA */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setActiveView('colorimetria')}
                className="cursor-pointer group relative overflow-hidden rounded-2xl p-6 elegant-card border border-slate-200/60 dark:border-slate-800/80 hover:border-[var(--accent-orange)]/50 transition-all duration-300 shadow-xl hover:shadow-[var(--accent-orange)]/10"
              >
                <div className="absolute top-0 right-0 w-44 h-44 bg-[var(--accent-orange)]/10 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-[var(--accent-orange)]/20 transition-all duration-500 pointer-events-none" />
                <div className="flex flex-col h-full justify-between relative z-10">
                  <div>
                    {/* Header: Ícono y al frente Título + Subtítulo */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="rounded-xl p-3 bg-gradient-to-br from-[var(--accent-orange)]/20 to-[var(--accent-orange)]/5 border border-[var(--accent-orange)]/25 dark:border-slate-700/50 flex-shrink-0 flex items-center justify-center transition-all duration-300 group-hover:from-[var(--accent-orange)]/30 group-hover:to-[var(--accent-orange)]/15 group-hover:scale-105 shadow-md shadow-[var(--accent-orange)]/10 w-16 h-16">
                        <img
                          src={IconoAjustes}
                          alt="Colorímetro / Espectrómetro"
                          className="h-10 w-10 object-contain drop-shadow transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>
                      <div className="flex-grow min-w-0">
                        <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400 block mb-0.5">
                          Laboratorio Quimresa
                        </span>
                        <h3 className="text-xl font-bold tracking-tight text-[#CC5200] group-hover:text-[#b84800] transition-colors leading-tight">
                          COLORIMETRÍA
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          Medición, formulación y control de calidad
                        </p>
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed line-clamp-3 mb-6" style={{ color: 'var(--text-secondary)', opacity: 0.9 }}>
                      Accede a las herramientas de escaneo espectral, formulación estándar y personal, control de calidad y búsqueda de color en bibliotecas.
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-slate-300 group-hover:text-[var(--accent-orange)] transition-colors pt-4 border-t border-slate-200/20 dark:border-slate-800/80">
                    <span className="tracking-wider text-[11px] uppercase">Ingresar a Colorimetría</span>
                    <div className="flex-shrink-0 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-full opacity-70 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[var(--accent-orange)] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Contenedor 2: CONSUMO DE PROYECTOS */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setActiveView('consumoproyectos')}
                className="cursor-pointer group relative overflow-hidden rounded-2xl p-6 elegant-card border border-slate-200/60 dark:border-slate-800/80 hover:border-[#005EC3]/50 transition-all duration-300 shadow-xl hover:shadow-[#005EC3]/10"
              >
                <div className="absolute top-0 right-0 w-44 h-44 bg-[#005EC3]/10 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-[#005EC3]/20 transition-all duration-500 pointer-events-none" />
                <div className="flex flex-col h-full justify-between relative z-10">
                  <div>
                    {/* Header: Ícono y al frente Título + Subtítulo */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="rounded-xl p-3 bg-gradient-to-br from-[#005EC3]/20 to-[#005EC3]/5 border border-[#005EC3]/25 dark:border-slate-700/50 flex-shrink-0 flex items-center justify-center transition-all duration-300 group-hover:from-[#005EC3]/30 group-hover:to-[#005EC3]/15 group-hover:scale-105 shadow-md shadow-[#005EC3]/10 w-16 h-16">
                        <Pipette className="h-8 w-8 text-[#005EC3] dark:text-blue-400 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <span className="text-[10px] font-bold tracking-widest uppercase block mb-0.5">
                          Actividad y Operaciones
                        </span>
                        <h3 className="text-xl font-bold tracking-tight text-[#073c76] group-hover:text-[#004ca0] transition-colors leading-tight">
                          CONSUMO DE PROYECTOS
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          Control de rendimiento e insumos
                        </p>
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed line-clamp-3 mb-6" style={{ color: 'var(--text-secondary)', opacity: 0.9 }}>
                      Gestiona la predicción de consumos, rendimiento por proyecto, trazabilidad operativa y análisis comparativo de producción.
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-slate-300 group-hover:text-[#005EC3] dark:group-hover:text-blue-400 transition-colors pt-4 border-t border-slate-200/20 dark:border-slate-800/80">
                    <span className="tracking-wider text-[11px] uppercase">Ingresar a Consumo de Proyectos</span>
                    <div className="flex-shrink-0 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-full opacity-70 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#005EC3] dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {activeView === 'colorimetria' && (
          <Colorimetria
            userData={userData}
            onBack={() => setActiveView('main')}
            onOpenLocalizacion={() => setShowLocalizacion(true)}
          />
        )}

        {activeView === 'consumoproyectos' && (
          <ConsumoProyectos
            userData={userData}
            onBack={() => setActiveView('main')}
          />
        )}
      </main>

      {/* Footer Status Bar */}
      <footer className="mt-auto flex justify-between items-center text-[10px] text-slate-600 border-t border-slate-800 p-6 uppercase tracking-tighter bg-slate-900/20">
        <div className="flex gap-4">
          <span>Estado: Protegido</span>
        </div>
        <div>
          Quimresa Digital Color System v0.0.1 © 2026
        </div>
      </footer>

      <AnimatePresence>
        {showHistorialControl && (
          <HistorialControl onClose={() => setShowHistorialControl(false)} />
        )}
      </AnimatePresence>

      <CustomerSearch
        isOpen={showCustomerSearch}
        onClose={() => setShowCustomerSearch(false)}
        onSelect={handleSelectClient}
      />

      {showLocalizacion && (
        <LocalizacionClientes
          onClose={() => setShowLocalizacion(false)}
          userData={userData}
        />
      )}
    </div>
  );
}
