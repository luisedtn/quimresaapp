import React, { useState, useEffect } from 'react';
import { Search, X, Check, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { API_BASE_URL } from '../config';

interface Cliente {
    ID: number;
    NOMBRE: string;
    LOGO: string | null;
}

interface CustomerSearchProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (cliente: Cliente) => void;
}

export default function CustomerSearch({ isOpen, onClose, onSelect }: CustomerSearchProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const fetchInitial = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                // We assume /api/clientes exists for admins/type 0
                const res = await fetch(`${API_BASE_URL}/api/clientes`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setClientes(data);
                }
            } catch (err) {
                console.error("Error fetching clientes:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchInitial();
    }, [isOpen]);

    const filtered = clientes.filter(c =>
        c.NOMBRE.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 overflow-hidden flex flex-col max-h-[80vh]"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Seleccionar Cliente</h2>
                            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="relative mb-6">
                            <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Buscar cliente por nombre..."
                                className="w-full rounded-xl bg-slate-800 border border-slate-700 py-4 pr-4 pl-12 text-sm text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="overflow-y-auto flex-grow custom-scrollbar space-y-2 pr-2">
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                                </div>
                            ) : filtered.length > 0 ? (
                                filtered.map(cliente => (
                                    <button
                                        key={cliente.ID}
                                        onClick={() => onSelect(cliente)}
                                        className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-800/30 hover:bg-slate-800 hover:border-slate-700 transition-all group"
                                    >
                                        <div className="h-12 w-12 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                            {cliente.LOGO ? (
                                                <img src={cliente.LOGO} alt={cliente.NOMBRE} className="w-full h-full object-cover" />
                                            ) : (
                                                <Building2 className="h-6 w-6 text-slate-600" />
                                            )}
                                        </div>
                                        <div className="text-left flex-grow">
                                            <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{cliente.NOMBRE}</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">ID: {cliente.ID}</p>
                                        </div>
                                        <Check className="h-5 w-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                ))
                            ) : (
                                <div className="text-center py-12 text-slate-500">
                                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-10" />
                                    <p className="text-sm">No se encontraron clientes...</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
