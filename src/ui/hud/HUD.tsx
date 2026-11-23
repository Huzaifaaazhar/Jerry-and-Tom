import { useGame } from '@engine/core/store';
import { getEpisode } from '@engine/episode/registry';
import { getCharacter } from '@engine/characters/registry';
import { Check, Clock, Cross, ITEM_ICONS, Paw, Pause, Bolt, Laugh, Eye } from '../components/Icons';
import { useEffect, useState } from 'react';
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
        {hud.stage && (
          <div className="hud-stage">
            <ol className="stage-dots" aria-label={`Mission ${hud.stage.index + 1} of ${hud.stage.total}`}>
              {Array.from({ length: hud.stage.total }).map((_, i) => (
                <li key={i} className={i < hud.stage!.index ? 'done' : i === hud.stage!.index ? 'now' : ''} />
              ))}
            </ol>
            <p className="stage-title">{hud.stage.title}</p>
          </div>
        )}
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

      <div className={`hud-clock ${low ? 'low' : ''} ${hud.stage?.timeLeft != null ? 'stage-timer' : ''}`} role="timer" aria-label={`Time left ${fmt(hud.timeLeft)}`}>
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

      {hud.role === 'prey' && hud.detection && (
        <div className={`detect detect-${hud.detection}`} role="status" aria-label={`Detection: ${DETECT_LABEL[hud.detection]}`}>
          <Eye />
          <span>{DETECT_LABEL[hud.detection]}</span>
        </div>
      )}
      {hud.role === 'hunter' && (
        <div className="scent" role="status" aria-label={hud.scent ? 'Pointing to where you last noticed the mouse' : 'No trail'}>
          <div className="scent-dial">
            {hud.scent && (
              <div className="scent-arrow" style={{ transform: `rotate(${hud.scent.angle}deg)`, opacity: 0.35 + hud.scent.fresh * 0.65 }} />
            )}
            <Paw />
          </div>
          <span>{hud.scent ? 'Last trace' : 'No trail'}</span>
        </div>
      )}

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

      {hud.prompt && !hud.stunned && !useGame.getState().cutscene && (
        <div className="prompt" role="status">
          <kbd>E</kbd>
          <span className="or-click">/ click</span>
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

      <StageBanner />
      <CutsceneOverlay />

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

const DETECT_LABEL = { hidden: 'Hidden', safe: 'Unseen', heard: 'He’s searching', seen: 'Spotted!' } as const;

function StageBanner() {
  const banner = useGame((s) => s.banner);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!banner) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3600);
    return () => clearTimeout(t);
  }, [banner]);
  if (!banner || !visible) return null;
  return (
    <div className="stage-banner" key={banner.key} role="status">
      <p className="stage-banner-kicker">
        Mission {banner.index + 1} of {banner.total}
      </p>
      <p className="stage-banner-title">{banner.title}</p>
      <p className="stage-banner-brief">{banner.brief}</p>
    </div>
  );
}

function CutsceneOverlay() {
  const c = useGame((s) => s.cutscene);
  if (!c) return null;
  return (
    <div className="cutscene" aria-live="polite">
      <div className="letterbox top" />
      <div className="letterbox bottom">
        {c.caption && <p className="cut-caption">{c.caption}</p>}
        {c.skippable && (
          <p className="cut-skip">
            <kbd>Space</kbd> skip
          </p>
        )}
      </div>
    </div>
  );
}

function DebugLine() {
  const p = world.player;
  return <pre className="debug">{p ? `${p.position.x.toFixed(1)} ${p.position.y.toFixed(1)} ${p.position.z.toFixed(1)}` : ''}</pre>;
}
