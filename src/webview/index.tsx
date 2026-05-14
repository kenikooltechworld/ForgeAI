import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';

console.log('[ForgeAI] React entry point loaded');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[ForgeAI] Root element not found!');
  throw new Error('Root element not found');
}

console.log('[ForgeAI] Root element found, creating React root');
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('[ForgeAI] Root component rendered');
