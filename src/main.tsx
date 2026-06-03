import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

// Inicializar tema de manera inmediata para evitar destellos
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.classList.remove('light', 'dark');
document.documentElement.classList.add(savedTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

defineCustomElements(window);
