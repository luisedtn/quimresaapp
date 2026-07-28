import { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Scan from './pages/Scan';
import QualityControl from './pages/QualityControl';
import Formulas from './pages/Formulas';
import Usuarios from './pages/Usuarios';
import Cuenta from './pages/Cuenta';
import Colorimetro from './pages/Colorimetro';
import StandardFormulas from './pages/StandardFormulas';
import ColorMatch from './pages/ColorMatch';
import ListaQC from './pages/ListaQC';
import ColorAiChat from './components/ColorAiChat';
import ScreenBrightness from './services/ScreenBrightness';
import { API_BASE_URL } from './config';

function registrarAcceso(latitud: number | null, longitud: number | null) {
  const token = localStorage.getItem('token');
  const userDataStr = localStorage.getItem('userData');
  console.log('[ACCESO] registrarAcceso llamado', { latitud, longitud, tieneToken: !!token, tieneUserData: !!userDataStr });
  if (!token || !userDataStr) {
    console.warn('[ACCESO] Sin token o userData, saltando registro');
    return;
  }

  const userDataObj = JSON.parse(userDataStr);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
  if (userDataObj?.idcliente) {
    headers['x-client-id'] = userDataObj.idcliente.toString();
  }

  console.log('[ACCESO] Enviando peticion POST a', `${API_BASE_URL}/api/registrar-acceso`);
  fetch(`${API_BASE_URL}/api/registrar-acceso`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ latitud, longitud })
  })
    .then(res => res.json().then(data => ({ status: res.status, data })))
    .then(({ status, data }) => console.log('[ACCESO] Respuesta del servidor:', { status, data }))
    .catch(err => console.error('[ACCESO] Error al registrar acceso:', err));
}

async function obtenerUbicacion(): Promise<{ latitud: number; longitud: number } | null> {
  console.log('[ACCESO] Intentando obtener ubicacion...');
  console.log('[ACCESO] Capacitor disponible?:', !!(window as any).Capacitor, 'isNative?:', (window as any).Capacitor?.isNative);
  if (navigator.geolocation) {
    console.log('[ACCESO] navigator.geolocation disponible, intentando...');
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          console.log('[ACCESO] Ubicacion obtenida:', pos.coords.latitude, pos.coords.longitude);
          resolve({ latitud: pos.coords.latitude, longitud: pos.coords.longitude });
        },
        err => {
          console.warn('[ACCESO] Error en geolocation:', err.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }
  console.warn('[ACCESO] navigator.geolocation NO disponible');
  return null;
}

export default function App() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const maxBrightness = localStorage.getItem('maxBrightness') === 'true';
    if (maxBrightness) {
      ScreenBrightness.setBrightness({ brightness: 1 });
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(r => { wakeLockRef.current = r; }).catch(() => {});
      }
    }
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  const [userData, setUserData] = useState<any>(() => {
    const saved = localStorage.getItem('userData');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const isAuthenticated = !!userData;

  useEffect(() => {
    if (!isAuthenticated) return;
    obtenerUbicacion().then(coords => {
      registrarAcceso(coords?.latitud ?? null, coords?.longitud ?? null);
    });
  }, [isAuthenticated]);

  const handleMockLogin = (data: any) => {
    localStorage.setItem('userData', JSON.stringify(data));
    setUserData(data);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    setUserData(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--bg-app)' }}>
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--accent-color)', borderTopColor: 'transparent' }}></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login onLogin={handleMockLogin} />} />
        <Route
          path="/"
          element={isAuthenticated ? <Dashboard userData={userData} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/scan"
          element={isAuthenticated ? <Scan userData={userData} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/quality-control"
          element={isAuthenticated ? <QualityControl /> : <Navigate to="/login" />}
        />
        <Route
          path="/formulas"
          element={isAuthenticated ? <Formulas email={userData?.email} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/usuarios"
          element={isAuthenticated ? <Usuarios userData={userData} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/cuenta"
          element={isAuthenticated ? <Cuenta userData={userData} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/colorimetro"
          element={isAuthenticated ? <Colorimetro userData={userData} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/libraries"
          element={isAuthenticated ? <StandardFormulas onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/color-match"
          element={isAuthenticated ? <ColorMatch userData={userData} /> : <Navigate to="/login" />}
        />
        <Route
          path="/lista-qc"
          element={isAuthenticated ? <ListaQC /> : <Navigate to="/login" />}
        />
      </Routes>
      {isAuthenticated && <ColorAiChat />}
    </BrowserRouter>
  );
}
