import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Scan from './pages/Scan';
import QualityControl from './pages/QualityControl';
import Formulas from './pages/Formulas';
import Usuarios from './pages/Usuarios';
import Cuenta from './pages/Cuenta';
import Colorimetro from './pages/Colorimetro';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const isAuthenticated = !!userData;

  const handleMockLogin = (data: any) => {
    setUserData(data);
    setLoading(false);
  };

  const handleLogout = async () => {
    await auth.signOut();
    setUserData(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          // Fallback if user document doesn't exist but has auth
          setUserData({ email: user.email, uid: user.uid });
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading && !userData) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0F14]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#004A99] border-t-transparent"></div>
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
          element={isAuthenticated ? <Scan userData={userData} /> : <Navigate to="/login" />}
        />
        <Route
          path="/quality-control"
          element={isAuthenticated ? <QualityControl /> : <Navigate to="/login" />}
        />
        <Route
          path="/formulas"
          element={isAuthenticated ? <Formulas email={user?.email || userData?.email} /> : <Navigate to="/login" />}
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
      </Routes>
    </BrowserRouter>
  );
}
