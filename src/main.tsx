import './ui/theme.css';
import './i18n/fonts.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { initI18n } from './i18n';

// The language must be loaded before the app (and the game content it builds) is imported.
void initI18n().then(() => import('./ui/App')).then(({ App }) => {
  createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
});
