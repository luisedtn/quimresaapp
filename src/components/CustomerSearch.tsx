import React, { useState, useEffect } from 'react';
import { Search, X, Check, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { API_BASE_URL } from '../config';

interface Cliente {
    CODIGO: number;
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
        (c.NOMBRE || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                        className="relative w-full max-w-lg shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
                        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)' }}
                    >
                        {/* Header */}
                        <div
                            className="flex items-center justify-between px-6 py-4 shadow-sm flex-shrink-0 bg-quimresa-accent"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-white/10 rounded-lg">
                                    <Building2 className="h-4 w-4 text-white" />
                                </div>
                                <h2 className="text-sm font-bold text-white uppercase tracking-widest">Seleccionar Cliente</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-90"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="px-5 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-card)' }}>
                            <div className="relative">
                                <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Buscar cliente por nombre..."
                                    className="w-full rounded-xl py-3 pr-4 pl-11 text-sm outline-none transition-all"
                                    style={{
                                        backgroundColor: 'var(--bg-card-hover)',
                                        border: '1px solid var(--border-card)',
                                        color: 'var(--text-primary)',
                                    }}
                                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-orange)'; }}
                                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-card)'; }}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            {!loading && (
                                <p className="text-[10px] mt-2 uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>
                                    {filtered.length} cliente{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>

                        {/* Client List */}
                        <div className="overflow-y-auto flex-grow p-4 space-y-2">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-14 gap-3">
                                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                                        style={{ borderColor: 'var(--accent-orange)', borderTopColor: 'transparent' }}
                                    />
                                    <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>Cargando clientes...</p>
                                </div>
                            ) : filtered.length > 0 ? (
                                filtered.map(cliente => (
                                    <motion.button
                                        key={cliente.CODIGO}
                                        whileHover={{ y: -1, scale: 1.005 }}
                                        whileTap={{ scale: 0.995 }}
                                        onClick={() => onSelect(cliente)}
                                        className="w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 group text-left"
                                        style={{
                                            backgroundColor: 'var(--bg-card-hover)',
                                            border: '1px solid var(--border-card)',
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.borderColor = 'var(--accent-orange)';
                                            e.currentTarget.style.borderOpacity = '0.4';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.borderColor = 'var(--border-card)';
                                        }}
                                    >
                                        {/* Logo / Icon */}
                                        <div className="h-11 w-11 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                                            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
                                            {cliente.LOGO ? (
                                                <img src={cliente.LOGO} alt={cliente.NOMBRE} className="w-full h-full object-cover" />
                                            ) : (
                                                <Building2 className="h-5 w-5" style={{ color: 'var(--accent-orange)' }} />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-grow min-w-0">
                                            <p className="text-sm font-bold uppercase tracking-tight truncate transition-colors"
                                                style={{ color: 'var(--text-primary)' }}
                                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-orange)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                                            >
                                                {cliente.NOMBRE}
                                            </p>
                                            <p className="text-[10px] uppercase font-bold tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                ID: {cliente.CODIGO}
                                            </p>
                                        </div>

                                        {/* Select indicator */}
                                        <div className="flex-shrink-0 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                            style={{ backgroundColor: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)' }}>
                                            <Check className="h-4 w-4" style={{ color: 'var(--accent-orange)' }} />
                                        </div>
                                    </motion.button>
                                ))
                            ) : (
                                <div className="text-center py-14">
                                    <Building2 className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)', opacity: 0.2 }} />
                                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                                        {searchTerm ? `Sin resultados para "${searchTerm}"` : 'No se encontraron clientes'}
                                    </p>
                                    {searchTerm && (
                                        <button
                                            onClick={() => setSearchTerm('')}
                                            className="mt-3 text-xs font-bold uppercase tracking-widest hover:underline transition-all active:scale-95"
                                            style={{ color: 'var(--accent-orange)' }}
                                        >
                                            Limpiar búsqueda
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 flex-shrink-0 flex justify-end" style={{ borderTop: '1px solid var(--border-card)' }}>
                            <button
                                onClick={onClose}
                                className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                                style={{
                                    backgroundColor: 'var(--bg-card-hover)',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border-card)',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-orange)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-card)'; }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
