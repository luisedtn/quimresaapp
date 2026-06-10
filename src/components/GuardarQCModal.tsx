import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

interface GuardarQCModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (name: string, desc: string, libId: number, colId: number) => Promise<void>;
  initialName?: string;
  initialDesc?: string;
}

interface Libreria {
  id: number;
  nombre: string;
}

interface Coleccion {
  id: number;
  nombre: string;
}

export default function GuardarQCModal({
  isOpen,
  onClose,
  onSaveSuccess,
  initialName = '',
  initialDesc = ''
}: GuardarQCModalProps) {
  const [sessionName, setSessionName] = useState(initialName);
  const [notes, setNotes] = useState(initialDesc);

  const [libraryObj, setLibraryObj] = useState<Libreria | null>(null);
  const [collectionObj, setCollectionObj] = useState<Coleccion | null>(null);
  const [collections, setCollections] = useState<Coleccion[]>([]);

  const [view, setView] = useState<'main' | 'select-collection' | 'add-collection'>('main');
  const [newItemName, setNewItemName] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const userDataStr = localStorage.getItem('userData');
  const userDataObj = userDataStr ? JSON.parse(userDataStr) : null;
  const clientName = userDataObj?.empresa || 'Cliente Default';

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    const headers: any = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
    if (userDataObj?.idcliente) {
      headers['x-client-id'] = userDataObj.idcliente.toString();
    }
    return headers;
  };

  const fetchOrCreateLibrary = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/librerias`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        let clientLib = data.find((l: any) => l.nombre === clientName);
        if (clientLib) {
          setLibraryObj(clientLib);
        } else {
          // create it automatically if not found
          const resCreate = await fetch(`${API_BASE_URL}/api/librerias`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ nombre: clientName })
          });
          if (resCreate.ok) {
            const newLib = await resCreate.json();
            setLibraryObj(newLib);
          }
        }
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
        if (data.length > 0) {
          setCollectionObj(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSessionName(initialName);
      setNotes(initialDesc);
      setErrorMessage('');
      setView('main');
      setNewItemName('');
      fetchOrCreateLibrary();
    }
  }, [isOpen, initialName, initialDesc]);

  useEffect(() => {
    if (libraryObj) {
      fetchCollections(libraryObj.id);
    } else {
      setCollections([]);
    }
  }, [libraryObj]);

  const handleSave = async () => {
    if (!sessionName.trim()) {
      setErrorMessage('Por favor ingresa un nombre/lote para el control');
      return;
    }
    if (!libraryObj) {
      setErrorMessage('Falta la librería por defecto');
      return;
    }
    if (!collectionObj) {
      setErrorMessage('Por favor selecciona una colección');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      await onSaveSuccess(sessionName.trim(), notes.trim(), libraryObj.id, collectionObj.id);
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
      <h2 className="text-center text-lg font-bold tracking-wide mb-6 text-slate-900 dark:text-white">Guardar Control de Calidad</h2>

      {errorMessage && (
        <div className="mb-4 text-xs font-semibold text-red-700 dark:text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded p-2 text-center">
          {errorMessage}
        </div>
      )}

      <div className="space-y-5 flex-1">
        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-500 uppercase tracking-widest mb-1">Nombre / Lote *</label>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            className="w-full bg-transparent border-b border-slate-300 dark:border-slate-800 focus:border-blue-500 dark:focus:border-[#d4af37] text-sm py-1.5 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 text-slate-900 dark:text-white font-medium"
            placeholder="Nombre o lote de la muestra"
          />
        </div>

        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-500 uppercase tracking-widest mb-1">Librería (Cliente)</label>
          <div className="w-full bg-transparent border-b border-slate-300 dark:border-slate-800 text-sm py-1.5 text-slate-900 dark:text-white font-medium opacity-70">
            {libraryObj ? libraryObj.nombre : clientName}
          </div>
        </div>

        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-500 uppercase tracking-widest mb-1">Colección *</label>
          <div
            onClick={() => {
              if (!libraryObj) {
                setErrorMessage('Cargando librería...');
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
          className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-widest bg-[#cc5200] hover:bg-slate-100 dark:hover:bg-slate-900 text-white dark:text-slate-300 transition-colors border-r border-slate-200 dark:border-slate-800"
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
          className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-widest bg-[#cc5200] hover:bg-slate-100 dark:hover:bg-slate-900 text-white dark:text-slate-300 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );

  const renderAddView = (
    title: string,
    label: string,
    onSaveAdd: () => void,
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
          className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-widest bg-[#cc5200] hover:bg-slate-100 dark:hover:bg-slate-900 text-white dark:text-slate-300 transition-colors border-r border-slate-200 dark:border-slate-800"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSaveAdd}
          disabled={!newItemName.trim() || isSaving}
          className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-widest bg-[#1e293b] text-white hover:bg-slate-700 dark:bg-[#d4af37] dark:text-black dark:hover:bg-[#c9a227] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Guardando...' : 'OK'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60001] flex items-center justify-center  backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-[10px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0A0F14]/40 backdrop-blur-xl text-slate-900 dark:text-white shadow-2xl overflow-hidden flex flex-col min-h-[280px]">
        {view === 'main' && renderMainForm()}

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

        {view === 'add-collection' && renderAddView(
          'Crear colección',
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
