import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { ModelProvider } from './contexts/ModelContext';
import { OmicsProvider } from './contexts/OmicsContext';

console.log('Starting React app...');
const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ThemeProvider>
          <ModelProvider>
            <OmicsProvider>
              <App />
            </OmicsProvider>
          </ModelProvider>
        </ThemeProvider>
      </React.StrictMode>
    );
    console.log('React rendered successfully');
  } catch (error) {
    console.error('React render error:', error);
    rootElement.innerHTML = `<div style="color:red;padding:20px">Error: ${error.message}</div>`;
  }
} else {
  console.error('Root element not found!');
}
