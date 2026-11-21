import { useEffect } from 'react';
import { useGame } from '@engine/core/store';
import { audio } from '@engine/audio/audio';

export function SettingsPanel() {
  const { settings, updateSettings } = useGame();
  useEffect(() => audio.setVolumes(settings.sfxVolume, settings.musicVolume), [settings.sfxVolume, settings.musicVolume]);
  return (
    <section className="settings" aria-label="Settings">
      <h3>Settings</h3>
      <label>
        <span>Music</span>
        <input type="range" min={0} max={1} step={0.05} value={settings.musicVolume} onChange={(e) => updateSettings({ musicVolume: +e.target.value })} />
      </label>
      <label>
        <span>Sound effects</span>
        <input type="range" min={0} max={1} step={0.05} value={settings.sfxVolume} onChange={(e) => updateSettings({ sfxVolume: +e.target.value })} />
      </label>
      <label>
        <span>Look sensitivity</span>
        <input type="range" min={0.3} max={2.5} step={0.1} value={settings.mouseSensitivity} onChange={(e) => updateSettings({ mouseSensitivity: +e.target.value })} />
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.invertY} onChange={(e) => updateSettings({ invertY: e.target.checked })} />
        <span>Invert vertical look</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.reducedMotion} onChange={(e) => updateSettings({ reducedMotion: e.target.checked })} />
        <span>Reduce camera shake</span>
      </label>
      <label>
        <span>Touch controls</span>
        <select value={settings.touchControls} onChange={(e) => updateSettings({ touchControls: e.target.value as 'auto' | 'on' | 'off' })}>
          <option value="auto">Automatic</option>
          <option value="on">Always on</option>
          <option value="off">Off</option>
        </select>
      </label>
    </section>
  );
}
