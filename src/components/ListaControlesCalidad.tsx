import React, { useState, useEffect } from 'react';
import { X, FileText, Loader2, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface PDFFile {
    name: string;
    url: string;
    date: string;
}

interface ListaControlesCalidadProps {
    onClose: () => void;
    clientCode: string;
}

export default function ListaControlesCalidad({ onClose, clientCode }: ListaControlesCalidadProps) {
    const [pdfs, setPdfs] = useState<PDFFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPDFs = async () => {
            try {
                setIsLoading(true);
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/api/pdfs/${clientCode}`, {
                    headers: {
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                });

                if (!response.ok) {
                    throw new Error('Error al obtener lista de PDFs');
                }

                const data = await response.json();
                setPdfs(data);
            } catch (err: any) {
                setError(err.message || 'Error desconocido');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPDFs();
    }, [clientCode]);

    const handleOpenPdf = (url: string) => {
        // Abrir visor de PDF en nueva pestaña (usará la ruta estática /controlcalidad/...)
        window.open(`${API_BASE_URL}${url}`, '_blank');
    };

    return (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-start bg-[#0A0F14]/95 backdrop-blur-md overflow-y-auto w-full p-4 md:p-8">
            {/* Header */}
            <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-2xl mb-6 sticky top-4 z-10">
                <h2 className="text-white font-bold flex items-center gap-2 uppercase tracking-wide">
                    <FileText className="w-5 h-5 text-red-500" /> Reportes de Calidad - Cliente: {clientCode}
                </h2>
                <button
                    onClick={onClose}
                    className="p-2 border border-slate-700 bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors hover:bg-slate-700"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Grid de PDFs */}
            <div className="w-full max-w-5xl">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                        <Loader2 className="w-12 h-12 animate-spin mb-4 text-red-500" />
                        <p className="font-semibold uppercase tracking-widest text-sm text-slate-300">Cargando reportes...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-6 rounded-2xl text-center font-semibold">
                        {error}
                    </div>
                ) : pdfs.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 text-slate-400 p-16 rounded-2xl text-center flex flex-col items-center shadow-xl">
                        <FileText className="w-16 h-16 mb-4 opacity-30" />
                        <p className="font-semibold uppercase tracking-widest text-sm">No existen reportes PDF guardados aún.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                        {pdfs.map((pdf, idx) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                key={idx}
                                onClick={() => handleOpenPdf(pdf.url)}
                                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-slate-800 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/10 transition-all group"
                            >
                                <div className="relative">
                                    <FileText className="w-16 h-16 text-red-500/80 group-hover:text-red-500 group-hover:scale-110 transition-all duration-300" />
                                    <div className="absolute -bottom-2 -right-2 bg-slate-800 rounded-full p-1.5 border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 text-slate-300">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                                <div className="text-center w-full">
                                    <p className="text-slate-200 text-sm font-bold truncate w-full group-hover:text-white transition-colors" title={pdf.name}>
                                        {pdf.name}
                                    </p>
                                    <p className="text-slate-500 text-[10px] mt-1 font-semibold uppercase tracking-wider">
                                        {new Date(pdf.date).toLocaleDateString()}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
