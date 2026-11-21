import { useGame } from '@engine/core/store';
import { getEpisode } from '@engine/episode/registry';
import { getCharacter } from '@engine/characters/registry';
import { Check, Clock, Cross, ITEM_ICONS, Paw, Pause, Bolt, Laugh } from '../components/Icons';
import { world } from '@engine/core/world';

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function HUD() {
  const hud = useGame((s) => s.hud);
  const toasts = useGame((s) => s.toasts);
  const episodeId = useGame((s) => s.episodeId);
  const characterId = useGame((s) => s.characterId);
  const loading = useGame((s) => s.loading);
  const setPaused = useGame((s) => s.setPaused);
  const ep = getEpisode(episodeId!);
  const def = getCharacter(characterId!);
  const low = hud.timeLeft < 30;
  const main = hud.objectives.filter((o) => !o.optional);
  const bonus = hud.objectives.filter((o) => o.optional);
  return (
    <div className={`hud ${hud.chase > 0.5 ? 'is-chase' : ''} ${hud.hidden ? 'is-hidden' : ''}`}>
      <div className="chase-vignette" aria-hidden="true" />
      {hud.hidden && <div className="peephole" aria-hidden="true" />}

      <section className="hud-mission panel-sm" aria-label="Mission">
        <p className="hud-ep">
          Ep {ep.number} · {ep.title}
        </p>
        <ul>
          {main.map((o) => (
            <li key={o.id} className={o.done ? 'done' : ''}>
              <span className="tick" aria-hidden="true">{o.done ? <Check /> : null}</span>
              <span className="obj-label">{o.label}</span>
              {o.target > 1 && (
                <span className="obj-count">
                  {o.progress}/{o.target}
                </span>
              )}
            </li>
          ))}
        </ul>
        {bonus.length > 0 && (
          <ul className="bonus">
            {bonus.map((o) => (
              <li key={o.id} className={o.done ? 'done' : o.failed ? 'failed' : ''}>
                <span className="tick" aria-hidden="true">{o.done ? <Check /> : o.failed ? <Cross /> : null}</span>
                <span className="obj-label">{o.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={`hud-clock ${low ? 'low' : ''}`} role="timer" aria-label={`Time left ${fmt(hud.timeLeft)}`}>
        <Clock />
        <span>{fmt(hud.timeLeft)}</span>
        {hud.chase > 0.5 && <span className="chase-stamp">Chase!</span>}
      </div>

      <div className="hud-topright">
        {hud.lives && (
          <div className="lives panel-sm" aria-label={`${hud.lives.current} of ${hud.lives.max} chances left`}>
            {Array.from({ length: hud.lives.max }).map((_, i) => (
              <Paw key={i} className={i < hud.lives!.current ? 'life on' : 'life'} />
            ))}
          </div>
        )}
        <button className="btn btn-icon hud-pause" aria-label="Pause" onClick={() => setPaused(true)}>
          <Pause />
        </button>
      </div>
      {hud.room && <p className="hud-room">{hud.room}</p>}

      <section className="hud-bottom-left">
        <div className="who" style={{ ['--char' as string]: def.ui.color }}>
          <span className="who-name">{def.name}</span>
          <div className="stamina" role="meter" aria-label="Stamina" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.stamina * 100)}>
            <div className="stamina-fill" style={{ transform: `scaleX(${hud.stamina})` }} />
          </div>
        </div>
        <div className="kit">
          {Object.entries(hud.charges).map(([k, n]) => {
            const Icon = ITEM_ICONS[k];
            return (
              <div className="kit-slot" key={k} aria-label={`${n} ${k}`}>
                {Icon && <Icon />}
                <span className="kit-n">{n}</span>
                <kbd>Q</kbd>
              </div>
            );
          })}
          {def.ability && (
            <div className="kit-slot" aria-label={def.ability}>
              {def.ability === 'pounce' ? <Bolt /> : <Laugh />}
              <kbd>F</kbd>
            </div>
          )}
        </div>
      </section>

      {hud.prompt && !hud.stunned && (
        <div className="prompt" role="status">
          <kbd>E</kbd>
          <span>{hud.prompt}</span>
        </div>
      )}
      {hud.stunned && <div className="prompt prompt-bad">Seeing stars…</div>}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <p key={t.id} className={`toast toast-${t.tone}`}>
            {t.text}
          </p>
        ))}
      </div>

      {loading && (
        <div className="loading" role="status">
          <div className="loading-card">
            <span className="loading-title">{ep.title}</span>
            <span>Setting the stage…</span>
          </div>
        </div>
      )}
      {import.meta.env.DEV && useGame.getState().settings.showDebug && <DebugLine />}
    </div>
  );
}

function DebugLine() {
  const p = world.player;
  return <pre className="debug">{p ? `${p.position.x.toFixed(1)} ${p.position.y.toFixed(1)} ${p.position.z.toFixed(1)}` : ''}</pre>;
}
