import { useGame } from '@engine/core/store';
import { audio } from '@engine/audio/audio';
import { SettingsPanel } from './SettingsPanel';

export function PauseMenu() {
  const { setPaused, restart, goTo } = useGame();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className="pause panel">
        <h2 id="pause-title" className="title-card">
          Paused
        </h2>
        <div className="pause-actions">
          <button className="btn btn-primary" autoFocus onClick={() => (audio.play('ui'), setPaused(false))}>
            Resume
          </button>
          <button className="btn" onClick={() => (audio.play('ui'), restart())}>
            Restart episode
          </button>
          <button className="btn" onClick={() => (audio.play('uiBack'), goTo('episodes'))}>
            Quit to episodes
          </button>
        </div>
        <SettingsPanel />
      </div>
    </div>
  );
}
