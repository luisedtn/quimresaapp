import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

interface GuardarEscaneoProps {
  isOpen: boolean;
  onClose: () => void;
  measurement: any;
  onSaveSuccess: (savedMedicion: any) => void;
  onLogout?: () => void;
}

export default function GuardarEscaneo({
  isOpen,
  onClose,
  measurement,
  onSaveSuccess,
  onLogout
}: GuardarEscaneoProps) {
  const [colorName, setColorName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (measurement?.color?.hex) {
        setColorName(`Color ${measurement.color.hex.toUpperCase()}`);
      } else {
        setColorName('Color Escaneado');
      }
      setNotes('');
      setErrorMessage('');
    }
  }, [isOpen, measurement]);

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    const userDataStr = localStorage.getItem('userData');
    const userDataObj = userDataStr ? JSON.parse(userDataStr) : null;
    const headers: any = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
    if (userDataObj?.idcliente) {
      headers['x-client-id'] = userDataObj.idcliente.toString();
    }
    return headers;
  };

  const handleSave = async () => {
    if (!colorName.trim()) {
      setErrorMessage('Por favor ingresa un nombre para el color');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      const c = measurement.color;
      const bodyPayload: any = {
        nombre: colorName.trim(),
        notas: notes.trim() || null,
        fecha: measurement.timestamp || new Date().toISOString(),
        L: c.L,
        A: c.a,
        B: c.b,
        R: c.R,
        G: c.G,
        RB: c.B,
        C: c.C,
        H: c.H,
        X: c.X,
        Y: c.Y,
        Z: c.Z,
        hex: c.hex,
        LRV: c.LRV,
        Density: c.Density,
      };
      if (c.cmyk) {
        bodyPayload.cmykC = c.cmyk.C;
        bodyPayload.cmykM = c.cmyk.M;
        bodyPayload.cmykY = c.cmyk.Y;
        bodyPayload.cmykK = c.cmyk.K;
      }

      const res = await fetch(`${API_BASE_URL}/api/mediciones`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(bodyPayload)
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          onLogout?.();
          return;
        }
        throw new Error('No se pudo guardar la medición');
      }

      const savedMed = await res.json();
      onSaveSuccess(savedMed);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-[10px] border border-slate-800 bg-[#0A0F14] text-white shadow-2xl overflow-hidden flex flex-col min-h-[280px]">
        <div className="flex flex-col flex-1 p-6">
          <h2 className="text-center text-lg font-bold tracking-wide mb-6">Guardar medición</h2>

          {errorMessage && (
            <div className="mb-4 text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20 rounded p-2 text-center">
              {errorMessage}
            </div>
          )}

          <div className="space-y-5 flex-1">
            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Nombre de fórmula *</label>
              <input
                type="text"
                value={colorName}
                onChange={(e) => setColorName(e.target.value)}
                className="w-full bg-transparent border-b border-slate-800 focus:border-[#d4af37] text-sm py-1.5 focus:outline-none placeholder-slate-600 text-white font-medium"
                placeholder="Nombre de la medición"
              />
            </div>

            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Notas</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-transparent border-b border-slate-800 focus:border-[#d4af37] text-sm py-1.5 focus:outline-none placeholder-slate-600 text-white font-medium"
                placeholder="Notas adicionales"
              />
            </div>
          </div>

          <div className="flex border-t border-slate-800 mt-6 -mx-6 -mb-6 h-[50px]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 text-xs font-bold uppercase tracking-widest bg-transparent hover:bg-slate-900 text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 text-xs font-bold uppercase tracking-widest bg-white text-black hover:bg-slate-200 transition-colors disabled:bg-slate-800 disabled:text-slate-500"
            >
              {isSaving ? 'Guardando...' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}