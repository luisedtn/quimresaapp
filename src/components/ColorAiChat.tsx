import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Wand2, Sparkles, User, Bot, Calculator, BarChart3 } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface Message {
    role: 'user' | 'ai';
    text: string;
}

export default function ColorAiChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // Handle opening and loading context
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const qcData = localStorage.getItem('qc_context');
            if (qcData) {
                try {
                    const data = JSON.parse(qcData);
                    if (data.standard && data.sample) {
                        const contextMsg = `Hola. He analizado los datos actuales: 
            - Patrón: L=${data.standard.l}, a=${data.standard.a}, b=${data.standard.b}
            - Muestra: L=${data.sample.l}, a=${data.sample.a}, b=${data.sample.b}
            - Delta E (CIE2000): ${data.de}
            ¿Qué deseas hacer con este control de calidad? Puedo ayudarte a ajustar la mezcla o analizar la desviación.`;

                        setMessages([{ role: 'ai', text: contextMsg }]);
                    }
                } catch (e) {
                    console.error("Error parsing QC context", e);
                }
            }
        }
    }, [isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
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
                    message: userMsg,
                    history: messages.slice(-10)
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

    const clearChat = () => {
        setMessages([]);
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
                        className="fixed bottom-24 right-6 z-[60] w-[350px] max-w-[calc(100vw-48px)] h-[500px] bg-[#121820] border border-slate-700 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
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
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user'
                                            ? 'bg-violet-600 text-white rounded-br-none shadow-lg'
                                            : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700 shadow-xl'
                                        }`}>
                                        {msg.text}
                                    </div>
                                </div>
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
                                    onClick={handleSend}
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
