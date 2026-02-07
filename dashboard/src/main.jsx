import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker for offline support and stale-while-revalidate caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('✓ Service Worker registered (SWR caching enabled)');
        
        // Check for updates periodically
        setInterval(() => {
          reg.update().catch(err => console.warn('SW update check failed:', err));
        }, 60000); // Check every minute
      })
      .catch(err => {
        console.warn('Service Worker registration failed:', err);
        console.warn('App will still work but without offline support');
      });
  });
}

