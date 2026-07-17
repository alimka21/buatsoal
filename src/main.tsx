import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler for unhandled rejections
window.addEventListener("unhandledrejection", (event) => {
  // Filter out benign Vite HMR websocket connection errors that are expected when running in sandboxed or proxied environments
  if (
    event.reason &&
    (String(event.reason).includes("WebSocket closed without opened") ||
     String(event.reason).includes("failed to connect to websocket"))
  ) {
    return;
  }
  console.error("Unhandled rejection:", event.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
