import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/styles/mario_style.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Register Service Worker for offline support and static asset caching
if ('serviceWorker' in navigator) {
  globalThis.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(err => {
      console.log('Service Worker registration failed:', err);
    });
  });
}
