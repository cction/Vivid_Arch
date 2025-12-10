
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import { StartupGate } from './src/bootstrap/StartupGate';
import './src/styles/tailwind.css';
import './src/styles/podui.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <div className="podui-theme-dark">
      <StartupGate>
        <App />
      </StartupGate>
    </div>
  </React.StrictMode>
);
