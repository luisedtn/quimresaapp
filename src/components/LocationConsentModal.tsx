import { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, Shield, Truck, Package, Building2 } from 'lucide-react';

interface LocationConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export default function LocationConsentModal({ isOpen, onAccept }: LocationConsentModalProps) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setScrolledToBottom(false);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [isOpen]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const threshold = 60;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    setScrolledToBottom(isAtBottom);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60001] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,12,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-sm rounded-[14px] border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#0d141e] text-slate-900 dark:text-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-3 text-center border-b border-slate-100 dark:border-slate-800/50">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.15), rgba(217,119,6,0.05))', border: '1px solid rgba(217,119,6,0.25)' }}>
            <MapPin className="h-7 w-7" style={{ color: 'var(--accent-orange, #d97706)' }} />
          </div>
          <h2 className="text-base font-bold tracking-tight">Permiso de Ubicación</h2>
          <p className="text-[10px] mt-1 font-medium uppercase tracking-widest text-slate-500 dark:text-slate-500">Requerido para continuar</p>
        </div>

        {/* Contenido scrolleable */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
          style={{ scrollBehavior: 'smooth' }}
        >
          {/* Sección: ¿Por qué necesitamos tu ubicación? */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(217,119,6,0.1)' }}>
                <Shield className="h-3.5 w-3.5" style={{ color: 'var(--accent-orange, #d97706)' }} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-400">¿Por qué necesitamos tu ubicación?</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 pl-8">
              La aplicación Quimresa requiere acceso a la ubicación del dispositivo para registrar la posición exacta de tu empresa. Esta información es fundamental para optimizar la operación logística de entrega de productos.
            </p>
          </div>

          {/* Sección: Uso específico */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(217,119,6,0.1)' }}>
                <Truck className="h-3.5 w-3.5" style={{ color: 'var(--accent-orange, #d97706)' }} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-400">¿Cómo utilizamos tu ubicación?</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 pl-8">
              Los datos de ubicación se emplean exclusivamente para los siguientes propósitos:
            </p>
            <ul className="space-y-2.5 pl-8">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent-orange, #d97706)' }}></div>
                <span className="text-[12px] text-slate-600 dark:text-slate-400">
                  <strong className="font-semibold text-slate-700 dark:text-slate-300">Registro de empresa:</strong> Almacenar las coordenadas exactas de la ubicación de tu negocio para facilitar el proceso de despacho.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent-orange, #d97706)' }}></div>
                <span className="text-[12px] text-slate-600 dark:text-slate-400">
                  <strong className="font-semibold text-slate-700 dark:text-slate-300">Logística de envíos:</strong> Planificar rutas eficientes para el envío de pedidos, reduciendo tiempos de entrega y costos operativos.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent-orange, #d97706)' }}></div>
                <span className="text-[12px] text-slate-600 dark:text-slate-400">
                  <strong className="font-semibold text-slate-700 dark:text-slate-300">Distribución optimizada:</strong> Mejorar la distribución geográfica de productos basándonos en la concentración de clientes por zona.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent-orange, #d97706)' }}></div>
                <span className="text-[12px] text-slate-600 dark:text-slate-400">
                  <strong className="font-semibold text-slate-700 dark:text-slate-300">Control de acceso:</strong> Registrar tu ingreso a la plataforma para fines de seguridad y auditoría interna.
                </span>
              </li>
            </ul>
          </div>

          {/* Sección: Privacidad */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(217,119,6,0.1)' }}>
                <Package className="h-3.5 w-3.5" style={{ color: 'var(--accent-orange, #d97706)' }} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-400">Tu privacidad es importante</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 pl-8">
              Queremos que tengas total confianza al usar nuestra aplicación. Por eso, queremos aclarar algunos puntos importantes sobre cómo protegemos tu información:
            </p>
            <ul className="space-y-2.5 pl-8">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent-orange, #d97706)' }}></div>
                <span className="text-[12px] text-slate-600 dark:text-slate-400">
                  No rastreamos tu ubicación en tiempo real. Solo capturamos la coordenada en el momento del registro de acceso.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent-orange, #d97706)' }}></div>
                <span className="text-[12px] text-slate-600 dark:text-slate-400">
                  Los datos de ubicación se almacenan de forma segura y cifrada en nuestros servidores.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent-orange, #d97706)' }}></div>
                <span className="text-[12px] text-slate-600 dark:text-slate-400">
                  No compartimos tu ubicación con terceros ni la utilizamos para publicidad dirigida.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent-orange, #d97706)' }}></div>
                <span className="text-[12px] text-slate-600 dark:text-slate-400">
                  Puedes revocar el permiso en cualquier momento desde la configuración de tu dispositivo.
                </span>
              </li>
            </ul>
          </div>

          {/* Sección: Beneficios */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(217,119,6,0.1)' }}>
                <Building2 className="h-3.5 w-3.5" style={{ color: 'var(--accent-orange, #d97706)' }} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-400">Beneficios para tu empresa</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 pl-8">
              Al permitir el acceso a la ubicación, tu empresa se beneficia de:
            </p>
            <ul className="space-y-2.5 pl-8">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent-orange, #d97706)' }}></div>
                <span className="text-[12px] text-slate-600 dark:text-slate-400">
                  Entregas más rápidas y precisas gracias a la optimización de rutas.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent-orange, #d97706)' }}></div>
                <span className="text-[12px] text-slate-600 dark:text-slate-400">
                  Mejor gestión del inventario basada en la demanda geográfica.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent-orange, #d97706)' }}></div>
                <span className="text-[12px] text-slate-600 dark:text-slate-400">
                  Reportes de ubicación para análisis de cobertura territorial.
                </span>
              </li>
            </ul>
          </div>

          {/* Indicador de scroll */}
          {!scrolledToBottom && (
            <div className="flex flex-col items-center py-2 text-slate-400 dark:text-slate-600 animate-bounce">
              <span className="text-[10px] font-medium uppercase tracking-widest mb-1">Desplázate para continuar</span>
              <ChevronDown className="h-4 w-4" />
            </div>
          )}

          <div className="h-4"></div>
        </div>

        {/* Footer con botón */}
        <div className="flex-shrink-0 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-[#0a0f14]">
          <div className="p-4 space-y-2">
            <button
              onClick={onAccept}
              disabled={!scrolledToBottom}
              className="w-full h-11 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              style={{
                background: scrolledToBottom ? 'linear-gradient(135deg, #d97706, #b45309)' : 'var(--bg-card, #1e293b)',
                color: scrolledToBottom ? '#fff' : 'var(--text-muted, #94a3b8)',
                boxShadow: scrolledToBottom ? '0 4px 20px rgba(217,119,6,0.3)' : 'none'
              }}
            >
              {scrolledToBottom ? 'Habilitar Ubicación' : 'Desplázate hasta el final'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}