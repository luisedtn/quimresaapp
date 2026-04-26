import React, { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Mail, Lock, LogIn, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '../config';


interface LoginProps {
  onLogin: (userData: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ correo: email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }

      // Store token
      localStorage.setItem('token', data.token);

      onLogin({
        email: data.user.name,
        nombre: data.user.name,
        empresa: data.user.empresa,
        autorizado: true,
        logoUrl: 'https://placehold.co/400x150/white/003366?text=Quimresa+S.A.'
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-[#0A0F14]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Left Side: Logo & Info */}
        <div className="flex flex-col items-center justify-center bg-white p-6 md:p-12 md:w-1/2 border-b md:border-b-0 md:border-r border-slate-100">
          <img
            src="https://placehold.co/400x150/white/003366?text=Quimresa+S.A."
            alt="Quimresa Logo"
            className="mb-4 md:mb-8 w-48 md:w-64 border border-gray-200 rounded-lg"
            referrerPolicy="no-referrer"
          />
          <div className="text-center text-xs text-slate-400 space-y-1">
            <p className="font-bold text-slate-800 uppercase tracking-widest text-[10px]">Quimresa S.A. Laboratory</p>
            <p>ISO 9001:2015 Certified System</p>
            <p className="hidden md:block">Quito - Ecuador</p>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="bg-[#fcf8f2] p-6 md:p-12 md:w-1/2 flex flex-col justify-center">
          <div className="mb-6 md:mb-10 text-center">
            <h2 className="text-xl md:text-2xl font-bold text-[#003366] tracking-tight">Acceso al Sistema</h2>
            <p className="text-slate-500 text-[10px] md:text-sm mt-1 uppercase tracking-widest font-medium">Colorimetría Digital</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 md:space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email de Usuario</label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-300" />
                <input
                  type="email"
                  placeholder="ejemplo@quimresa.com"
                  className="w-full rounded-lg border border-slate-200 bg-white py-3 pr-4 pl-10 focus:border-[#c07204] focus:ring-4 focus:ring-[#c07204]/5 outline-none transition-all text-slate-700"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-300" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-200 bg-white py-3 pr-4 pl-10 focus:border-[#c07204] focus:ring-4 focus:ring-[#c07204]/5 outline-none transition-all text-slate-700"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && <p className="text-center text-xs text-red-500 font-medium bg-red-50 p-2 rounded">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-lg bg-[#c07204] py-4 text-sm font-bold text-white transition-all hover:bg-[#a66203] active:scale-[0.98] disabled:bg-slate-300 shadow-lg shadow-[#c07204]/20 uppercase tracking-widest"
            >
              {loading ? 'Validando...' : 'Iniciar Sesión'}
              {!loading && <ChevronRight className="ml-2 h-5 w-5" />}
            </button>
          </form>

          <footer className="mt-12 text-center text-[10px] text-slate-400 uppercase tracking-tighter">
            <div className="flex justify-center gap-4 border-t border-slate-200 pt-4">
              <span>Soporte Técnico</span>
              <span>•</span>
              <span>Políticas de Privacidad</span>
            </div>
          </footer>
        </div>
      </motion.div>
    </div>
  );
}
