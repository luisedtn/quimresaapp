import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, User, Settings, ShoppingBag, Wrench, Mail, Bug, FileText, Shield, Lock, LogOut, Users, BluetoothConnected, BluetoothOff, Power } from 'lucide-react';
import { useNixDevice } from '../hooks/useNixDevice';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  userData?: any;
}

export default function Sidebar({ isOpen, onClose, onLogout, userData }: SidebarProps) {
  const navigate = useNavigate();
  const { isConnected, deviceInfo, disconnect } = useNixDevice();

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
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest italic">Menú</h2>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-6 space-y-2">
              {/* My Account */}
              <AccordionSection title="Mi cuenta" defaultOpen={false}>
                <div className="space-y-1">
                  <SidebarItem icon={User} label="Información de la cuenta" onClick={() => navigate('/cuenta')} />
                  <SidebarItem icon={Users} label="Usuarios de mi empresa" onClick={() => navigate('/usuarios')} />
                  <SidebarItem icon={Settings} label="Ajustes globales de la app" />
                </div>
              </AccordionSection>

              {/* Devices */}
              <AccordionSection title="Dispositivos" defaultOpen={false}>
                <div className="px-6 py-3">
                  {isConnected && deviceInfo ? (
                    <div className="flex items-center justify-between group bg-slate-900/50 p-2 rounded-xl border border-slate-800/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <BluetoothConnected className="h-4 w-4 text-green-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{deviceInfo.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">{deviceInfo.type}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          disconnect();
                        }}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        title="Desconectar"
                      >
                        <BluetoothOff className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 bg-slate-900/20 rounded-xl border border-dashed border-slate-800">
                      <p className="text-slate-600 text-sm italic">Sin dispositivos</p>
                      <button
                        onClick={() => {
                          onClose();
                          navigate('/colorimetro');
                        }}
                        className="mt-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors"
                      >
                        Conectar ahora
                      </button>
                    </div>
                  )}
                </div>
              </AccordionSection>

              {/* Nix Resources */}
              <AccordionSection title="Quimresa" defaultOpen={false}>
                <div className="space-y-1 mt-2">
                  {/* <SidebarItem icon={ShoppingBag} label="Comprar dispositivos Nix" showChevron /> */}
                  <SidebarItem icon={Wrench} label="Resolución de problemas" showChevron />
                  <SidebarItem icon={Mail} label="Contáctanos" showChevron />
                  <SidebarItem icon={Bug} label="Reportar un error" showChevron />
                </div>
              </AccordionSection>

              {/* Resources */}
              <AccordionSection title="Recursos" defaultOpen={false}>
                <div className="space-y-1 mt-2">
                  <SidebarItem icon={FileText} label="Información regulatoria" />
                  <SidebarItem icon={Shield} label="Descargos de responsabilidad" />
                  <SidebarItem icon={Lock} label="Política de privacidad" showChevron />
                </div>
              </AccordionSection>

              {/* Account Actions */}
              <section className="mt-8 mb-4">
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

function AccordionSection({
  title,
  children,
  defaultOpen = false
}: {
  title: string,
  children: React.ReactNode,
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-6 py-2 flex items-center justify-between group focus:outline-none"
      >
        <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">{title}</h3>
        <motion.div
          initial={false}
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
        </motion.div>
      </button>
      <div className="px-6 mb-2">
        <div className="h-[1px] bg-slate-800 w-full"></div>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function SidebarItem({ icon: Icon, label, showChevron, onClick }: { icon: any, label: string, showChevron?: boolean, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-900/50 transition-colors group text-left focus:outline-none"
    >
      <div className="flex items-center gap-4">
        <Icon className="h-4 w-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
        <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{label}</span>
      </div>
      {showChevron && <ChevronRight className="h-4 w-4 text-slate-600" />}
    </button>
  );
}
