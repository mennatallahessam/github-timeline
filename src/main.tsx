import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyInitialTheme } from './hooks/useTheme';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/timeline.css';
import './styles/print.css';

applyInitialTheme();

const container = document.getElementById('root');
if (!container) throw new Error('GitHub Timeline: #root element is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

