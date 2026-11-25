import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Briefcase, TrendingUp, BarChart3, Clock, AlertCircle } from 'lucide-react';

interface ConsumoProyectosProps {
  userData?: any;
  onBack?: () => void;
}

export default function ConsumoProyectos({ userData, onBack }: ConsumoProyectosProps) {
  return (
    <div className="w-full">
      <div className="px-6 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--accent-orange)]" />
              <span>Volver</span>
            </button>
          )}
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Consumo de Proyectos
          </h2>
        </div>
      </div>

      <div className="px-6 mb-12">
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-md">
          <div className="max-w-2xl mx-auto text-center py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 mb-6 text-amber-500 shadow-xl shadow-amber-500/10">
              <Briefcase className="w-10 h-10" />
            </div>

            <h3 className="text-2xl font-bold text-orange-600 mb-3 tracking-tight">
              Módulo de Consumo de Proyectos
            </h3>

            <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-lg mx-auto">
              Gestiona el rendimiento, historial de consumo de insumos y métricas de producción asociadas a cada proyecto de formulación y aplicación de color.
            </p>

            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-amber-500/80 bg-amber-500/10 border border-amber-500/20 py-2.5 px-4 rounded-xl w-fit mx-auto">
              <AlertCircle className="w-4 h-4" />
              <span>Módulo activo y listo para sincronizar con datos de proyectos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
