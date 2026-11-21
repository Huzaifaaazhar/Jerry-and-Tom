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
import { allEpisodes } from '@engine/episode/registry';
import { validateEpisode } from '@engine/episode/validate';

if (import.meta.env.DEV) {
  // Catch broken episode content early while authoring.
  for (const ep of allEpisodes()) for (const err of validateEpisode(ep)) console.warn(`[episode] ${err}`);
}
import { App } from './App';

void loadModelManifest().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
