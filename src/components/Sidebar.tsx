import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, User, Settings, ShoppingBag, Wrench, Mail, Bug, FileText, Shield, Lock, LogOut, Users } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  userData?: any;
}

export default function Sidebar({ isOpen, onClose, onLogout, userData }: SidebarProps) {
  const navigate = useNavigate();
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Sidebar Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-full max-w-[300px] bg-[#0A0F14] border-r border-slate-800 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest italic">Menú Lateral</h2>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-6">
              {/* My Account */}
              <section className="mb-8">
                <div className="px-6 mb-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">Mi cuenta</h3>
                  <div className="h-[1px] bg-slate-800 w-full mt-2"></div>
                </div>
                <div className="space-y-1">
                  <SidebarItem icon={User} label="Información de la cuenta" onClick={() => navigate('/cuenta')} />
                  <SidebarItem icon={Users} label="Usuarios de mi empresa" onClick={() => navigate('/usuarios')} />
                  <SidebarItem icon={Settings} label="Ajustes globales de la app" />
                </div>
              </section>

              {/* Devices */}
              <section className="mb-8">
                <div className="px-6 mb-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">Dispositivos</h3>
                  <div className="h-[1px] bg-slate-800 w-full mt-2"></div>
                </div>
                <div className="px-6 py-3">
                  <p className="text-slate-600 text-sm italic">--</p>
                </div>
              </section>

              {/* Nix Resources */}
              <section className="mb-8">
                <div className="px-6 mb-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">Recursos Nix</h3>
                  <div className="h-[1px] bg-slate-800 w-full mt-2"></div>
                </div>
                <div className="space-y-1">
                  <SidebarItem icon={ShoppingBag} label="Comprar dispositivos Nix" showChevron />
                  <SidebarItem icon={Wrench} label="Resolución de problemas" showChevron />
                  <SidebarItem icon={Mail} label="Contáctanos" showChevron />
                  <SidebarItem icon={Bug} label="Reportar un error" showChevron />
                </div>
              </section>

              {/* Resources */}
              <section className="mb-8">
                <div className="px-6 mb-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">Recursos</h3>
                  <div className="h-[1px] bg-slate-800 w-full mt-2"></div>
                </div>
                <div className="space-y-1">
                  <SidebarItem icon={FileText} label="Información regulatoria" />
                  <SidebarItem icon={Shield} label="Descargos de responsabilidad" />
                  <SidebarItem icon={Lock} label="Política de privacidad" showChevron />
                </div>
              </section>

              {/* Account Actions */}
              <section className="mb-8">
                <div className="px-6 mb-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">Sesión</h3>
                  <div className="h-[1px] bg-slate-800 w-full mt-2"></div>
                </div>
                <div className="space-y-1">
                  <SidebarItem
                    icon={LogOut}
                    label="Cerrar sesión"
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                  />
                </div>
              </section>
            </div>

            <div className="p-6 border-t border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Versión de la app 1.8.9 (build 392)</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SidebarItem({ icon: Icon, label, showChevron, onClick }: { icon: any, label: string, showChevron?: boolean, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-900/50 transition-colors group text-left"
    >
      <div className="flex items-center gap-4">
        <Icon className="h-4 w-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
        <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{label}</span>
      </div>
      {showChevron && <ChevronRight className="h-4 w-4 text-slate-600" />}
    </button>
  );
}
