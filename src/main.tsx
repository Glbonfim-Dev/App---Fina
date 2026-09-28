import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { handleNativeAuthCallback } from './lib/supabase';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Registra o service worker (permite instalar o app na tela inicial)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

if (Capacitor.isNativePlatform()) {
  void import('@capacitor/app').then(({ App: NativeApp }) =>
    NativeApp.addListener('appUrlOpen', ({ url }) => {
      void handleNativeAuthCallback(url)
        .then((type) => {
          window.location.hash = type === 'recovery' ? '/nova-senha' : '/';
        })
        .catch(() => {
          window.location.hash = '/entrar';
        });
    })
  );
}
