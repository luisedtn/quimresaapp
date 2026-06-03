import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

interface GuardarEscaneoProps {
  isOpen: boolean;
  onClose: () => void;
  measurement: any;
  onSaveSuccess: (savedMedicion: any) => void;
  onLogout?: () => void;
}

interface Libreria {
  id: number;
  nombre: string;
}

interface Coleccion {
  id: number;
  nombre: string;
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
  
  const [libraryObj, setLibraryObj] = useState<Libreria | null>(null);
  const [collectionObj, setCollectionObj] = useState<Coleccion | null>(null);
  
  const [libraries, setLibraries] = useState<Libreria[]>([]);
  const [collections, setCollections] = useState<Coleccion[]>([]);

  const [view, setView] = useState<'main' | 'select-library' | 'select-collection' | 'add-library' | 'add-collection'>('main');
  const [newItemName, setNewItemName] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

  const fetchLibraries = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/librerias`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLibraries(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCollections = async (libId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/librerias/${libId}/colecciones`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCollections(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (measurement?.color?.hex) {
        setColorName(`Color ${measurement.color.hex.toUpperCase()}`);
      } else {
        setColorName('Color Escaneado');
      }
      setNotes('');
      setLibraryObj(null);
      setCollectionObj(null);
      setErrorMessage('');
      setView('main');
      setNewItemName('');
      
      fetchLibraries();
    }
  }, [isOpen, measurement]);

  useEffect(() => {
    if (libraryObj) {
      fetchCollections(libraryObj.id);
    } else {
      setCollections([]);
    }
  }, [libraryObj]);

  const handleSave = async () => {
    if (!colorName.trim()) {
      setErrorMessage('Por favor ingresa un nombre para el color');
      return;
    }
    if (!libraryObj) {
      setErrorMessage('Por favor selecciona una librería');
      return;
    }
    if (!collectionObj) {
      setErrorMessage('Por favor selecciona una colección');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      const c = measurement.color;
      const bodyPayload: any = {
        nombre: colorName.trim(),
        id_libreria: libraryObj.id,
        id_coleccion: collectionObj.id,
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

  const renderMainForm = () => (
    <div className="flex flex-col flex-1 p-6">
      <h2 className="text-center text-lg font-bold tracking-wide mb-6 text-slate-900 dark:text-white">Guardar medición</h2>

      {errorMessage && (
        <div className="mb-4 text-xs font-semibold text-red-700 dark:text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded p-2 text-center">
          {errorMessage}
        </div>
      )}

      <div className="space-y-5 flex-1">
        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-500 uppercase tracking-widest mb-1">Nombre de fórmula *</label>
          <input
            type="text"
            value={colorName}
            onChange={(e) => setColorName(e.target.value)}
            className="w-full bg-transparent border-b border-slate-300 dark:border-slate-800 focus:border-blue-500 dark:focus:border-[#d4af37] text-sm py-1.5 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 text-slate-900 dark:text-white font-medium"
            placeholder="Nombre de la medición"
          />
        </div>

        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-500 uppercase tracking-widest mb-1">Librería *</label>
          <div
            onClick={() => setView('select-library')}
            className="w-full bg-transparent border-b border-slate-300 dark:border-slate-800 focus:border-blue-500 dark:focus:border-[#d4af37] text-sm py-1.5 focus:outline-none text-slate-900 dark:text-white font-medium cursor-pointer flex justify-between items-center"
          >
            <span className={libraryObj ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-600"}>
              {libraryObj ? libraryObj.nombre : "Seleccionar librería"}
            </span>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>

        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-500 uppercase tracking-widest mb-1">Colección *</label>
          <div
            onClick={() => {
              if (!libraryObj) {
                setErrorMessage('Primero debes seleccionar una librería');
              } else {
                setView('select-collection');
              }
            }}
            className="w-full bg-transparent border-b border-slate-300 dark:border-slate-800 focus:border-blue-500 dark:focus:border-[#d4af37] text-sm py-1.5 focus:outline-none text-slate-900 dark:text-white font-medium cursor-pointer flex justify-between items-center"
          >
            <span className={collectionObj ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-600"}>
              {collectionObj ? collectionObj.nombre : "Seleccionar colección"}
            </span>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>

        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-500 uppercase tracking-widest mb-1">Notas</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-transparent border-b border-slate-300 dark:border-slate-800 focus:border-blue-500 dark:focus:border-[#d4af37] text-sm py-1.5 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 text-slate-900 dark:text-white font-medium"
            placeholder="Notas adicionales"
          />
        </div>
      </div>

      <div className="flex border-t border-slate-200 dark:border-slate-800 mt-6 -mx-6 -mb-6 h-[50px]">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-widest bg-transparent hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors border-r border-slate-200 dark:border-slate-800"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-widest bg-[#1e293b] text-white hover:bg-slate-700 dark:bg-[#d4af37] dark:text-black dark:hover:bg-[#c9a227] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Guardando...' : 'OK'}
        </button>
      </div>
    </div>
  );

  const renderSelectionView = (
    title: string,
    label: string,
    items: any[],
    selectedItemId: number | undefined,
    onSelect: (item: any) => void,
    onAddClick: () => void,
    onCancel: () => void,
    addText: string
  ) => (
    <div className="flex flex-col flex-1 p-6">
      <h2 className="text-center text-lg font-bold tracking-wide mb-6 text-slate-900 dark:text-white">{title}</h2>
      
      <div className="space-y-4 flex-1 overflow-y-auto max-h-[300px]">
        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-500 uppercase tracking-widest mb-2">{label}</div>
        {items.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-600 pb-2 border-b border-slate-200 dark:border-slate-800">No hay elementos</div>
        ) : (
          items.map((item, idx) => (
            <div
              key={idx}
              onClick={() => onSelect(item)}
              className="flex justify-between items-center py-3 border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50"
            >
              <span className="text-sm text-slate-900 dark:text-white">{item.nombre}</span>
              {selectedItemId === item.id && (
                <svg className="w-4 h-4 text-blue-600 dark:text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              )}
            </div>
          ))
        )}
        
        <div 
          onClick={onAddClick}
          className="py-4 text-sm font-medium text-slate-700 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-[#d4af37] transition-colors flex items-center gap-2"
        >
          <span>+ {addText}</span>
        </div>
      </div>
  
      <div className="flex border-t border-slate-200 dark:border-slate-800 mt-6 -mx-6 -mb-6 h-[50px]">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-widest bg-transparent hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );

  const renderAddView = (
    title: string,
    label: string,
    onSave: () => void,
    onCancel: () => void
  ) => (
    <div className="flex flex-col flex-1 p-6">
      <h2 className="text-center text-lg font-bold tracking-wide mb-6 text-slate-900 dark:text-white">{title}</h2>
      
      <div className="space-y-4 flex-1">
        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-500 uppercase tracking-widest mb-1">{label} *</label>
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="w-full bg-transparent border-b border-slate-300 dark:border-slate-800 focus:border-blue-500 dark:focus:border-[#d4af37] text-sm py-1.5 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 text-slate-900 dark:text-white font-medium"
            placeholder={`Nombre de la ${label.toLowerCase()}`}
            autoFocus
          />
        </div>
      </div>
  
      <div className="flex border-t border-slate-200 dark:border-slate-800 mt-6 -mx-6 -mb-6 h-[50px]">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-widest bg-transparent hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors border-r border-slate-200 dark:border-slate-800"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!newItemName.trim() || isSaving}
          className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-widest bg-[#1e293b] text-white hover:bg-slate-700 dark:bg-[#d4af37] dark:text-black dark:hover:bg-[#c9a227] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Guardando...' : 'OK'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-[10px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0A0F14] text-slate-900 dark:text-white shadow-2xl overflow-hidden flex flex-col min-h-[280px]">
        {view === 'main' && renderMainForm()}
        
        {view === 'select-library' && renderSelectionView(
          'Seleccionar librería',
          'Librería',
          libraries,
          libraryObj?.id,
          (item) => { setLibraryObj(item); setCollectionObj(null); setView('main'); },
          () => { setView('add-library'); setNewItemName(''); },
          () => setView('main'),
          'Agregar nueva librería'
        )}

        {view === 'select-collection' && renderSelectionView(
          'Seleccionar colección',
          'Colección',
          collections,
          collectionObj?.id,
          (item) => { setCollectionObj(item); setView('main'); },
          () => { setView('add-collection'); setNewItemName(''); },
          () => setView('main'),
          'Agregar nueva colección'
        )}

        {view === 'add-library' && renderAddView(
          'Seleccionar librería',
          'Librería',
          async () => {
            if (newItemName.trim()) {
              setIsSaving(true);
              try {
                const res = await fetch(`${API_BASE_URL}/api/librerias`, {
                  method: 'POST',
                  headers: getHeaders(),
                  body: JSON.stringify({ nombre: newItemName.trim() })
                });
                if (res.ok) {
                  const data = await res.json();
                  setLibraries([...libraries, data]);
                  setLibraryObj(data);
                  setCollectionObj(null);
                  setView('main');
                } else {
                  throw new Error('Error al crear librería');
                }
              } catch (e: any) {
                setErrorMessage(e.message || 'Ocurrió un error');
              } finally {
                setIsSaving(false);
              }
            }
          },
          () => setView('select-library')
        )}

        {view === 'add-collection' && renderAddView(
          'Seleccionar colección',
          'Colección',
          async () => {
            if (newItemName.trim() && libraryObj) {
              setIsSaving(true);
              try {
                const res = await fetch(`${API_BASE_URL}/api/librerias/${libraryObj.id}/colecciones`, {
                  method: 'POST',
                  headers: getHeaders(),
                  body: JSON.stringify({ nombre: newItemName.trim() })
                });
                if (res.ok) {
                  const data = await res.json();
                  setCollections([...collections, data]);
                  setCollectionObj(data);
                  setView('main');
                } else {
                  throw new Error('Error al crear colección');
                }
              } catch (e: any) {
                setErrorMessage(e.message || 'Ocurrió un error');
              } finally {
                setIsSaving(false);
              }
            }
          },
          () => setView('select-collection')
        )}
      </div>
    </div>
  );
}