import React from 'react';
import { motion } from 'motion/react';
import {
  Scan,
  Layers,
  History,
  Library,
  Heart,
  Search,
  PaintBucket,
  ChevronRight,
  MapPin,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface ColorimetriaProps {
  userData: any;
  onBack?: () => void;
  onOpenLocalizacion?: () => void;
}

export default function Colorimetria({ userData, onBack, onOpenLocalizacion }: ColorimetriaProps) {
  const navigate = useNavigate();
  const isSuperUser = Boolean(userData?.issuper || userData?.isSuper);

  const menuItems = [
    { id: 'scan', icon: Scan, title: 'Escaneo único', desc: 'Obtén datos espectrales, RGB, HEX, CIELAB y más.', path: '/scan' },
    { id: 'match', icon: Search, title: 'Búsqueda de color', desc: 'Encuentra la coincidencia más cercana en bibliotecas de pintura.', path: '/color-match' },
    { id: 'formulas', icon: PaintBucket, title: 'Fórmulas Personales', desc: 'Ver tus formulaciones de color específicas.', path: '/formulas' },
    { id: 'libraries', icon: Library, title: 'Fórmulas stándard', desc: 'Explora tus fórmulas stándard.', path: '/libraries' },
    { id: 'qc', icon: Layers, title: 'Control de calidad', desc: 'Compara muestras contra un estándar e identifica si pasan o fallan.', path: '/quality-control' },
    { id: 'qc-history', icon: History, title: 'Historial de control', desc: 'Tu registro de sesiones de control de calidad.', path: '/lista-qc' },
    { id: 'favorites', icon: Heart, title: 'Colecciones', desc: 'Accede, descarga y edita tus colores favoritos.' },
    ...(isSuperUser ? [{ id: 'location', icon: MapPin, title: 'Ubicación Clientes', desc: 'Visualiza en mapa las ubicaciones de acceso de tus clientes.', path: '__localizacion__' }] : []),
  ];

  return (
    <div className="w-full">
      <div className="px-6 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Volver al menú principal"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--accent-orange)]" />
              <span>Volver</span>
            </button>
          )}
          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Laboratorio de Colorimetría
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Herramientas de medición, formulación y control de calidad</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-6 mb-12">
        {menuItems.map((item) => (
          <motion.button
            key={item.id}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => {
              if (item.path === '__localizacion__') {
                if (onOpenLocalizacion) {
                  onOpenLocalizacion();
                }
              } else if (item.path) {
                navigate(item.path);
              }
            }}
            className="elegant-card flex items-center gap-4 p-5 text-left transition-all duration-300 group border border-slate-200/60 dark:border-slate-800/80 rounded-2xl w-full"
          >
            <div className="rounded-xl p-3.5 bg-gradient-to-br from-[var(--accent-orange)]/15 to-[var(--accent-orange)]/5 border border-[var(--accent-orange)]/15 dark:border-slate-700/50 flex-shrink-0 flex items-center justify-center transition-all duration-300 group-hover:from-[var(--accent-orange)]/25 group-hover:to-[var(--accent-orange)]/15">
              <item.icon className="h-6 w-6 text-[var(--accent-orange)] transition-transform duration-300 group-hover:scale-110" />
            </div>
            <div className="flex-grow min-w-0 pr-2">
              <h3
                className="text-base font-bold tracking-tight transition-colors group-hover:text-[#005EC3] dark:group-hover:text-blue-400"
                style={{ color: 'var(--text-primary)' }}
              >
                {item.title}
              </h3>
              <p
                className="text-xs mt-1 leading-relaxed line-clamp-2"
                style={{ color: 'var(--text-secondary)', opacity: 0.9 }}
              >
                {item.desc}
              </p>
            </div>
            <div className="flex-shrink-0 bg-slate-100 dark:bg-slate-800/60 p-2 rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-300">
              <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
