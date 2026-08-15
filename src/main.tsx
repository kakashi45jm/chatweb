import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Debug logging for iPad issues
const isIpad = /iPad|iPhone|iPod/.test(navigator.userAgent);
if (isIpad) {
  console.log('[LiveCall] Device detected:', navigator.userAgent);
  console.log('[LiveCall] Platform:', navigator.platform);
  console.log('[LiveCall] Screen:', window.screen.width, 'x', window.screen.height);
  console.log('[LiveCall] DPR:', window.devicePixelRatio);
}

// Gracefully handle benign Vite dev HMR websocket notices
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason || '');
    if (
      reason.includes('WebSocket closed without opened') ||
      reason.includes('[vite] failed to connect') ||
      reason.includes('The play() request was interrupted')
    ) {
      event.preventDefault();
      event.stopPropagation();
    } else {
      console.error('[LiveCall] Unhandled rejection:', reason);
    }
  });

  // Catch all errors during initialization
  window.addEventListener('error', (event) => {
    console.error('[LiveCall] Error event:', event.error?.message, event.error?.stack);
  });
}

// Ensure root element exists
const rootElement = document.getElementById('root');
if (!rootElement) {
  const fallback = document.createElement('div');
  fallback.id = 'root';
  fallback.style.cssText = 'width: 100%; height: 100%; margin: 0; padding: 0;';
  document.body.appendChild(fallback);
  console.warn('[LiveCall] Root element not found, creating one');
}

// Render with error boundary
try {
  console.log('[LiveCall] Starting render...');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
  console.log('[LiveCall] Render complete');
} catch (error) {
  console.error('[LiveCall] Fatal error during render:', error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; padding: 20px;">
        <div style="text-align: center; max-width: 500px;">
          <h1 style="font-size: 24px; margin-bottom: 16px;">Fatal Error</h1>
          <p style="margin-bottom: 16px; color: #cbd5e1; font-size: 14px;">
            ${error instanceof Error ? error.message : String(error)}
          </p>
          <button onclick="location.reload()" style="padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">
            Reload
          </button>
        </div>
      </div>
    `;
  }
}
