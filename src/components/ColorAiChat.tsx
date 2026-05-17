import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Wand2, Sparkles, User, Bot, Calculator, BarChart3, Beaker } from 'lucide-react';
import { API_BASE_URL } from '../config';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
    role: 'user' | 'ai';
    text: string;
}

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function getLuminance(hex: string) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 1;
    return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

export default function ColorAiChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showRecButton, setShowRecButton] = useState(false);
    const [pigmentCatalog, setPigmentCatalog] = useState<{ code: string, color: string }[]>([]);
    const [lastSuggestions, setLastSuggestions] = useState<{ code: string, color: string, quantity: number }[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // Parsear sugerencias del último mensaje de la IA
    useEffect(() => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === 'ai') {
            const suggestions: any[] = [];
            const rows = lastMsg.text.split('\n');
            rows.forEach(row => {
                // Regex robusto para capturar: | Codigo [Color] | Cantidad |
                const match = row.match(/\|\s*([^|\[(]*?)\s*(?:[[(](#[a-f\d]{3,6})[\])]|(#[a-f\d]{3,6}))?\s*\|\s*([+\d., ]+).*?\|/i);
                if (match) {
                    const code = match[1].trim();
                    const color = match[2] || match[3] || '#808080';
                    const qtyStr = match[4].replace(/[+ ]/g, '').replace(',', '.').trim();
                    const qty = parseFloat(qtyStr);
                    if (code && !isNaN(qty) && qty > 0) {
                        suggestions.push({ code, color, quantity: qty });
                    }
                }
            });
            setLastSuggestions(suggestions);
        } else {
            setLastSuggestions([]);
        }
    }, [messages]);

    // Cargar catálogo de pigmentos para que la IA los conozca
    useEffect(() => {
        const fetchCatalog = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await fetch(`${API_BASE_URL}/api/componentes/catalogo`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (Array.isArray(data)) {
                    setPigmentCatalog(data);
                }
            } catch (e) {
                console.error("Error fetching pigment catalog", e);
            }
        };
        fetchCatalog();
    }, []);

    // Escuchar cambios en el contexto de color para resetear el chat
    useEffect(() => {
        const handleUpdate = () => {
            const qcData = localStorage.getItem('qc_context');
            if (qcData) {
                try {
                    const data = JSON.parse(qcData);
                    if (data.standard && data.sample) {
                        const isNewReading = data.sample.name.includes('Muestra Ajustada');
                        const msg = isNewReading
                            ? 'He detectado la nueva lectura de tu mezcla. Los datos de color y el Delta E se han actualizado. ¿Deseas una nueva recomendación para seguir ajustando?'
                            : 'He cargado los datos de la fórmula seleccionada. ¿Deseas una recomendación para mejorar el delta?';

                        setMessages([{ role: 'ai', text: msg }]);
                        setShowRecButton(true);
                    }
                } catch (e) {
                    console.error("Error parsing new QC context", e);
                }
            }
        };

        window.addEventListener('qc-context-updated', handleUpdate);
        return () => window.removeEventListener('qc-context-updated', handleUpdate);
    }, []);

    // Handle opening and loading context
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const qcData = localStorage.getItem('qc_context');
            if (qcData) {
                try {
                    const data = JSON.parse(qcData);
                    if (data.standard && data.sample) {
                        setMessages([{ role: 'ai', text: 'Hola. He detectado los datos de tu fórmula. ¿Deseas una recomendación para mejorar el delta?' }]);
                        setShowRecButton(true);
                    }
                } catch (e) {
                    console.error("Error parsing QC context", e);
                }
            }
        }
    }, [isOpen]);

    const handleSend = async (overrideMsg?: string, displayMsg?: string) => {
        const userMsg = displayMsg || overrideMsg || input.trim();
        const apiMsg = overrideMsg || input.trim();

        if (!apiMsg && !overrideMsg) return;
        if (isLoading) return;

        setInput('');

        // Construir historial asegurando que el prompt técnico (si existe) siempre esté presente
        const historyForApi = messages.filter(m => {
            // Siempre incluir el prompt técnico inicial
            if (m.text.includes('[SOLICITUD DE MEJORA DE DELTA]')) return true;
            // Incluir el resto de mensajes recientes (últimos 10 por ejemplo)
            const idx = messages.indexOf(m);
            return idx >= messages.length - 10;
        });

        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: apiMsg,
                    history: historyForApi
                })
            });

            const data = await response.json();
            if (data.text) {
                setMessages(prev => [...prev, { role: 'ai', text: data.text }]);
            } else {
                throw new Error(data.error || 'Error de IA');
            }
        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'ai', text: 'Lo siento, no pude procesar tu consulta. Verifica la conexión o la configuración de IA.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRequestRecommendation = () => {
        setShowRecButton(false);
        const qcData = localStorage.getItem('qc_context');
        if (!qcData) return;

        try {
            const data = JSON.parse(qcData);
            const liters = data.prepareAmount || 1.0;
            let technicalPrompt = `[SOLICITUD DE MEJORA DE DELTA]
He analizado estos datos para preparar ${liters} LT de la fórmula: 
- Volumen total: ${liters} Litros
- Patrón (Target): L=${data.standard.l}, a=${data.standard.a}, b=${data.standard.b}
- Color actual de la fórmula: L=${data.sample.l}, a=${data.sample.a}, b=${data.sample.b}
- Desviación (Target - Actual): dL=${data.dL || '0'}, da=${data.dA || '0'}, db=${data.dB || '0'}
- Diferencia Total (Delta E 2000): ${data.de}
Componentes actuales en la mezcla:`;

            if (data.componentColors && data.componentColors.length > 0) {
                data.componentColors.forEach((cc: any) => {
                    const qtyVal = cc.calculatedQuantity ? cc.calculatedQuantity : (cc.quantity || 0);
                    const qtyStr = typeof qtyVal === 'number' ? qtyVal.toFixed(2) : qtyVal;
                    // Incluir el hex para que la IA sepa el color
                    technicalPrompt += `\n- [${cc.isBase ? 'BASE' : 'PIGMENTO'}] ${cc.code} (Color Hex: ${cc.color || '#808080'}): ${qtyStr}g`;
                });
            }

            if (pigmentCatalog.length > 0) {
                technicalPrompt += `\n\nCATÁLOGO DE RECURSOS DISPONIBLES (si necesitas corregir ejes que los componentes actuales no cubren):`;
                pigmentCatalog.forEach(p => {
                    technicalPrompt += ` ${p.code} (${p.color}),`;
                });
            }

            technicalPrompt += `\n\nBasado en estos datos de color, componentes actuales y catálogo disponible, por favor estima qué cantidad hay que agregar de los pigmentos (existentes o del catálogo) que consideres necesarios para mejorar el delta y acercarlo lo más posible a cero. 
IMPORTANTE: Presenta los pigmentos adicionales sugeridos EN UNA TABLA DE MARKDOWN con las columnas: Pigmento (Código), Cantidad a Agregar (g), y Razón del ajuste.
En la columna 'Pigmento', usa ESTRICTAMENTE el formato: 'Código [#hex]'. Ejemplo: 'P-101 [#FF0000]'.`;

            handleSend(technicalPrompt, 'Si, recomiéndame una mejora');
        } catch (e) {
            console.error("Error building recommendation prompt", e);
        }
    };

    const handleApplySuggestions = () => {
        if (lastSuggestions.length === 0) return;

        window.dispatchEvent(new CustomEvent('apply-ai-suggestions', {
            detail: { suggestions: lastSuggestions }
        }));

        setIsOpen(false);
        setLastSuggestions([]);
    };

    const clearChat = () => {
        setMessages([]);
        setShowRecButton(false);
        setLastSuggestions([]);
        localStorage.removeItem('qc_context');
    };

    return (
        <>
            {/* Floating Button */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-[60] h-14 w-14 rounded-full bg-gradient-to-tr from-violet-600 to-blue-500 text-white shadow-2xl flex items-center justify-center border-2 border-white/20 backdrop-blur-md"
            >
                <Sparkles className="h-6 w-6" />
                <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full border-2 border-[#0A0F14] animate-pulse"></div>
            </motion.button>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 100 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 100 }}
                        className="fixed bottom-24 right-6 z-[60] w-[400px] max-w-[calc(100vw-48px)] h-[550px] bg-[#121820] border border-slate-700 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-violet-600 flex items-center justify-center">
                                    <Wand2 className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white leading-none">Asistente Quimresa</h3>
                                    <p className="text-[10px] text-green-400 mt-1 uppercase tracking-widest font-bold">IA Experto en Color</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={clearChat} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Limpiar chat">
                                    <BarChart3 className="h-4 w-4" />
                                </button>
                                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-[#121820] to-[#0A0F14]">
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                                    <Calculator className="h-10 w-10 text-slate-700 mb-2" />
                                    <p className="text-xs text-slate-500 italic">"¿Cómo puedo ajustar un color si el Delta E es 1.5 y está muy rojizo?"</p>
                                    <p className="text-xs text-slate-500 mt-2 italic">"Calcula el 15% de base neutra para 25kg de mezcla."</p>
                                </div>
                            )}
                            {messages.map((msg, i) => (
                                <React.Fragment key={i}>
                                    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[95%] rounded-xl px-3 py-2 text-xs ${msg.role === 'user'
                                            ? 'bg-violet-600 text-white rounded-br-none shadow-lg'
                                            : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700 shadow-xl overflow-x-auto'
                                            }`}>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    table: ({ node, ...props }) => <table className="w-full border-collapse my-2 border border-slate-600 text-[10px]" {...props} />,
                                                    thead: ({ node, ...props }) => <thead className="bg-slate-900" {...props} />,
                                                    th: ({ node, ...props }) => <th className="border border-slate-600 p-1 text-left font-bold" {...props} />,
                                                    td: ({ node, children, ...props }) => {
                                                        const content = String(children);
                                                        const colorMatch = content.match(/\[(#\w+)\]/);
                                                        if (colorMatch) {
                                                            const hex = colorMatch[1];
                                                            const cleanText = content.replace(colorMatch[0], '').trim();
                                                            const lum = getLuminance(hex);
                                                            return (
                                                                <td
                                                                    className="border border-slate-600 p-1 font-bold text-center"
                                                                    style={{
                                                                        backgroundColor: hex,
                                                                        color: lum > 0.5 ? '#000000' : '#ffffff',
                                                                        textShadow: lum > 0.5 ? 'none' : '0 1px 2px rgba(0,0,0,0.5)'
                                                                    }}
                                                                >
                                                                    {cleanText}
                                                                </td>
                                                            );
                                                        }
                                                        return <td className="border border-slate-600 p-1" {...props}>{children}</td>;
                                                    },
                                                }}
                                            >
                                                {msg.text}
                                            </ReactMarkdown>

                                            {/* Botón Aplicar Sugerencias (si es el último mensaje de la IA y tiene sugerencias) */}
                                            {i === messages.length - 1 && msg.role === 'ai' && lastSuggestions.length > 0 && (
                                                <button
                                                    onClick={handleApplySuggestions}
                                                    className="mt-3 w-full py-2 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-lg font-bold uppercase tracking-widest text-[9px] shadow-lg flex items-center justify-center gap-2"
                                                >
                                                    <Beaker className="h-3 w-3" />
                                                    Agregar cantidades
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {/* Botón de recomendación después del mensaje inicial de IA si hay contexto */}
                                    {i === 0 && msg.role === 'ai' && showRecButton && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex justify-start pl-2"
                                        >
                                            <button
                                                onClick={handleRequestRecommendation}
                                                className="bg-violet-600/20 border border-violet-500/50 text-violet-300 px-4 py-2 rounded-xl text-xs font-bold hover:bg-violet-600/30 transition-all flex items-center gap-2 shadow-lg shadow-violet-900/20 active:scale-95"
                                            >
                                                <Sparkles className="h-3.5 w-3.5" />
                                                Si, recomiéndame una mejora
                                            </button>
                                        </motion.div>
                                    )}
                                </React.Fragment>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-800 rounded-xl px-3 py-2 rounded-bl-none border border-slate-700 flex gap-1">
                                        <div className="h-1.5 w-1.5 bg-violet-400 rounded-full animate-bounce"></div>
                                        <div className="h-1.5 w-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                        <div className="h-1.5 w-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-slate-900 border-t border-slate-800">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Pregunta algo sobre color..."
                                    className="w-full bg-[#0A0F14] border border-slate-700 rounded-xl py-2.5 pl-4 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                                />
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isLoading}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-violet-500 hover:text-violet-400 disabled:text-slate-700"
                                >
                                    <Send className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
