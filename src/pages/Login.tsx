import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Lock, LogIn, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '../config';


interface LoginProps {
  onLogin: (userData: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (username.length < 8) {
      setError('El nombre de usuario debe tener al menos 8 caracteres.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ correo: username, password }),
      });

      const data = await response.json();
      console.log("[DEBUG] Login response data:", data);

      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }

      // Store token
      localStorage.setItem('token', data.token);

      onLogin({
        email: data.user.name,
        nombre: data.user.name,
        empresa: data.user.empresa,
        idcliente: data.user.idcliente,
        typeuser: data.user.typeuser,
        issuper: data.user.issuper,
        autorizado: true,
        logoUrl: 'https://placehold.co/400x150/white/003366?text=Quimresa+S.A.'
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-[var(--bg-app)] transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row w-full max-w-4xl overflow-hidden rounded-3xl bg-[var(--bg-card)] shadow-2xl border border-slate-200/60 dark:border-slate-800/80 transition-colors duration-300"
      >
        {/* Left Side: Logo & Info */}
        <div className="flex flex-col items-center justify-center bg-[var(--bg-sidebar)] p-8 md:p-12 md:w-1/2 border-b md:border-b-0 md:border-r border-slate-200/60 dark:border-slate-800/80 transition-colors duration-300">
          <div className="flex flex-col items-center mb-6">
            {/* SVG estilizado de alta calidad del logo de Quimresa */}
            <svg viewBox="0 0 200 200" className="w-40 h-40 md:w-52 md:h-52" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="quimGrad" x1="0%" y1="100%" x2="80%" y2="0%">
                  <stop offset="0%" stopColor="#C06000" />
                  <stop offset="60%" stopColor="#E27D16" />
                  <stop offset="100%" stopColor="#ECC22D" />
                </linearGradient>
              </defs>
              {/* Outer Ring "Q" */}
              <path
                d="M 100,30 C 138.6,30 170,61.4 170,100 C 170,119.3 162.2,136.8 149.6,149.6 L 165,165 L 140,165 L 132.5,157.5 C 123.1,164.2 112,168.2 100,169 C 61.4,169 30,137.6 30,99 C 30,60.4 61.4,30 100,30 Z M 100,48 C 71.8,48 49,70.8 49,99 C 49,127.2 71.8,150 100,150 C 112.5,150 123.9,145.5 132.8,138.1 L 115,120 L 145,120 L 149,124 C 151,120 152,110 152,99 C 152,70.8 129.2,48 100,48 Z"
                fill="url(#quimGrad)"
              />
              {/* Inner detail "Pointer/Pen" of Q */}
              <path d="M 145,120 L 165,165 L 140,165 Z" fill="var(--text-primary)" />
              {/* Bottom stylized Text */}
              <text x="100" y="192" fontFamily="'Outfit', 'Inter', sans-serif" fontWeight="900" fontSize="22" fill="var(--text-primary)" textAnchor="middle" letterSpacing="1">
                quimresa
              </text>
            </svg>
          </div>
          <div className="text-center space-y-1">
            <p className="font-bold uppercase tracking-widest text-xs" style={{ color: 'var(--text-primary)' }}>Quimresa Laboratorio</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ISO 9001:2015 Certificado</p>
            <p className="hidden md:block text-xs" style={{ color: 'var(--text-muted)' }}>Quito - Ecuador</p>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="bg-[var(--bg-card)] md:w-1/2 flex flex-col justify-center relative transition-colors duration-300">
          {/* Header bar - matches Dashboard header */}
          <div className="flex items-center justify-between px-8 py-4 bg-[#a38105] shadow-sm">
            <span className="text-xs font-bold text-white uppercase tracking-widest">Acceso al Sistema</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse"></span>
              <span className="text-[10px] text-white/80 uppercase tracking-wider font-semibold">Quimresa Color Lab</span>
            </div>
          </div>

          <div className="p-8 md:p-10">
          <div className="mb-6 md:mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Registro de Usuario</h2>
            <p className="text-xs font-semibold mt-1" style={{ color: 'var(--text-secondary)' }}>Quimresa S.A.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 md:space-y-5">
            <div className="space-y-1">
              <div className="relative">
                <User className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Usuario"
                  className="w-full rounded-lg border bg-[var(--bg-card)] py-3 pr-4 pl-10 focus:border-[#a38105] focus:ring-2 focus:ring-[#a38105]/10 outline-none transition-all placeholder-slate-500 text-sm"
                  style={{ borderColor: 'var(--border-card)', color: 'var(--text-primary)' }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="relative">
                <Lock className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  placeholder="Contraseña"
                  className="w-full rounded-lg border bg-[var(--bg-card)] py-3 pr-10 pl-10 focus:border-[#a38105] focus:ring-2 focus:ring-[#a38105]/10 outline-none transition-all placeholder-slate-500 text-sm"
                  style={{ borderColor: 'var(--border-card)', color: 'var(--text-primary)' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && <p className="text-center text-xs text-red-500 font-semibold bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center items-center rounded-lg bg-[#a38105] py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.985] disabled:bg-slate-700 shadow-md shadow-[#a38105]/20 uppercase tracking-widest cursor-pointer"
            >
              {loading ? 'Validando...' : 'Entrar'}
            </button>
          </form>

          <footer className="mt-8 text-center text-[11px] space-y-1" style={{ color: 'var(--text-muted)' }}>
            <p>Contáctenos:</p>
            <p className="font-light">Eje Transversal Carapungo OE8 - 500 y Calixto Muzo, Quito, Ecuador</p>
            <p className="font-light">Teléfonos: +(593) 2 - 6011300 | +(593) 9 - 99834752</p>
            <p className="font-medium mt-1">
              Web: <a href="https://www.quimresa.com" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: 'var(--accent-blue)' }}>https://www.quimresa.com</a> | Email: <a href="mailto:info@quimresa.com" className="hover:underline" style={{ color: 'var(--accent-blue)' }}>info@quimresa.com</a>
            </p>
          </footer>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
