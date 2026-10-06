import './style.css';
import { initApp } from './app.js';

// Boot the native-like Android web app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initApp());
} else {
  initApp();
}

// Register Service Worker for PWA and Mobile Installation
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration notice:', err);
    });
  });
}
