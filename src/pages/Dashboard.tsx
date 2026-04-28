import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Scan,
  Layers,
  History,
  Library,
  Heart,
  MessageCircle,
  Cloud,
  Settings,
  PaintBucket,
  LogOut,
  ChevronRight,
  Menu
} from 'lucide-react';
import Sidebar from '../components/Sidebar';

interface DashboardProps {
  userData: any;
  onLogout: () => void;
}

export default function Dashboard({ userData, onLogout }: DashboardProps) {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const menuItems = [
    { id: 'formulas', icon: PaintBucket, title: 'Fórmulas de Color', desc: 'Ver tus formulaciones de color específicas.', path: '/formulas' },
    { id: 'colorimetro', icon: Scan, title: 'Colorímetro Bluetooth', desc: 'Conecta tu Nix para escanear y capturar colores.', path: '/colorimetro' },
    { id: 'scan', icon: Scan, title: 'Escaneo único', desc: 'Obtén datos espectrales, RGB, HEX, CIELAB y más.', path: '/scan' },
    { id: 'match', icon: Layers, title: 'Búsqueda de color', desc: 'Encuentra la coincidencia más cercana en bibliotecas de pintura.' },
    { id: 'qc', icon: Layers, title: 'Control de calidad', desc: 'Compara muestras contra un estándar e identifica si pasan o fallan.', path: '/quality-control' },
    { id: 'qc-history', icon: History, title: 'Historial de control', desc: 'Tu registro de sesiones de control de calidad.' },
    { id: 'libraries', icon: Library, title: 'Gestionar bibliotecas', desc: 'Crea, adquiere y explora bibliotecas de color.' },
    { id: 'favorites', icon: Heart, title: 'Colores favoritos', desc: 'Accede, descarga y edita tus colores favoritos.' },
    { id: 'cloud', icon: Cloud, title: 'Panel en la nube', desc: 'Comparte colores, ve analíticas y gestiona usuarios.' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0F14] text-slate-200 font-sans flex flex-col overflow-x-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={onLogout}
        userData={userData}
      />

      {/* Top Navigation / Header */}
      <header className="fixed top-0 z-10 flex w-full items-center justify-between border-b border-slate-800 bg-[#0A0F14]/80 backdrop-blur-md px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-slate-400 hover:text-white transition-colors hover:bg-slate-800/50 rounded-lg"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="w-10 h-10 bg-[#004A99] rounded flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-blue-900/20">Q</div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white uppercase leading-none">Quimresa Color Lab</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <p className="text-[10px] text-slate-400">Cliente: <span className="text-slate-200 uppercase tracking-wider">{userData?.empresa || 'Industrial Polymers S.A.'}</span></p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col text-right mr-2">
            <p className="text-xs font-medium text-slate-300">{userData?.email || 'usuario@quimresa.com'}</p>
            <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Acceso Autorizado</p>
          </div>
          <button onClick={onLogout} className="p-2 text-slate-500 hover:text-white transition-colors bg-slate-800/30 rounded-lg">
            <LogOut className="h-5 w-5" />
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
              whileHover={{ y: -2, backgroundColor: 'rgba(30, 41, 59, 0.3)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => item.path && navigate(item.path)}
              className="elegant-card flex flex-col items-start gap-4 p-6 text-left transition-all hover:border-slate-600 group"
            >
              <div className="rounded-lg bg-slate-800/50 p-3 group-hover:bg-[#004A99]/20 transition-colors">
                <item.icon className="h-6 w-6 text-slate-300 group-hover:text-blue-400" />
              </div>
              <div className="flex-1 w-full">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <ChevronRight className="h-4 w-4 text-slate-700 group-hover:text-slate-400" />
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.desc}</p>
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
          Quimresa Digital Color System v4.0.12 © 2024
        </div>
      </footer>
    </div>
  );
}
