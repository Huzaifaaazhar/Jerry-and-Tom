import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/luckiest-guy/400.css';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import './styles/theme.css';
import './styles/ui.css';
import './content';
import { loadModelManifest } from '@engine/characters/registry';
import { App } from './App';

void loadModelManifest().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
