import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scan,
  Layers,
  History,
  Library,
  Heart,
  Search,
  MessageCircle,
  Cloud,
  Settings,
  PaintBucket,
  LogOut,
  ChevronRight,
  Menu,
  Power,
  Users
} from 'lucide-react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import Sidebar from '../components/Sidebar';
import HistorialControl from '../components/HistorialControl';
import CustomerSearch from '../components/CustomerSearch';

import IconoAjustes from '../assets/iconSpectro.svg';

interface DashboardProps {
  userData: any;
  onLogout: () => void;
}

export default function Dashboard({ userData, onLogout }: DashboardProps) {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showHistorialControl, setShowHistorialControl] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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
      logoUrl: cliente.LOGO || userData.logoUrl
    };
    localStorage.setItem('userData', JSON.stringify(updatedUserData));
    setShowCustomerSearch(false);
    // Reload to apply changes across the app
    window.location.reload();
  };

  const menuItems = [
    { id: 'scan', icon: Scan, title: 'Escaneo único', desc: 'Obtén datos espectrales, RGB, HEX, CIELAB y más.', path: '/scan' },
    { id: 'match', icon: Search, title: 'Búsqueda de color', desc: 'Encuentra la coincidencia más cercana en bibliotecas de pintura.', path: '/color-match' },
    { id: 'formulas', icon: PaintBucket, title: 'Fórmulas Personales', desc: 'Ver tus formulaciones de color específicas.', path: '/formulas' },
    // { id: 'colorimetro', icon: Scan, title: 'Colorímetro Bluetooth', desc: 'Conecta tu Nix para escanear y capturar colores.', path: '/colorimetro' },
    { id: 'libraries', icon: Library, title: 'Fórmulas stándard', desc: 'Explora tus fórmulas stándard.', path: '/libraries' },
    { id: 'qc', icon: Layers, title: 'Control de calidad', desc: 'Compara muestras contra un estándar e identifica si pasan o fallan.', path: '/quality-control' },
    { id: 'qc-history', icon: History, title: 'Historial de control', desc: 'Tu registro de sesiones de control de calidad.', path: '/lista-qc' },
    { id: 'favorites', icon: Heart, title: 'Colecciones', desc: 'Accede, descarga y edita tus colores favoritos.' },
    // { id: 'cloud', icon: Cloud, title: 'Panel en la nube', desc: 'Comparte colores, ve analíticas y gestiona usuarios.' },
  ];

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
                    className="flex-1 px-6 py-3 rounded-xl bg-[#a38105] hover:bg-[#FF8409]/80 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
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
        <div className="px-6 mb-6">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Herramientas de Laboratorio</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-6 mb-12">
          {menuItems.map((item) => (
            <motion.button
              key={item.id}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                if (item.path) {
                  navigate(item.path);
                }
              }}
              className="elegant-card flex items-center gap-4 p-5 text-left transition-all duration-300 group border border-slate-200/60 dark:border-slate-800/80 rounded-2xl w-full"
            >
              <div className="rounded-xl p-3.5 bg-gradient-to-br from-[#a38105]/15 to-[#a38105]/5 dark:from-slate-800/80 dark:to-slate-900/80 border border-[#a38105]/15 dark:border-slate-700/50 flex-shrink-0 flex items-center justify-center transition-all duration-300 group-hover:from-[#a38105]/25 group-hover:to-[#a38105]/15">
                <item.icon className="h-6 w-6 text-[#a38105] dark:text-[#d4af37] transition-transform duration-300 group-hover:scale-110" />
              </div>
              <div className="flex-grow min-w-0 pr-2">
                <h3 className="text-base font-bold tracking-tight transition-colors group-hover:text-[#005EC3] dark:group-hover:text-blue-400" style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </h3>
                <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)', opacity: 0.9 }}>
                  {item.desc}
                </p>
              </div>
              <div className="flex-shrink-0 bg-slate-100 dark:bg-slate-800/60 p-2 rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </motion.button>
          ))}
        </div>
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
    </div>
  );
}
