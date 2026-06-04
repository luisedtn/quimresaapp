import { useState, useEffect, useRef } from 'react';
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
          element={isAuthenticated ? <ColorMatch /> : <Navigate to="/login" />}
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
