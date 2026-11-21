import { useMemo, useState } from 'react';
import { useGame } from '@engine/core/store';
import { allEpisodes, getEnvironment } from '@engine/episode/registry';
import { getCharacter } from '@engine/characters/registry';
import { useProgress, isUnlocked, episodeCompletion } from '@engine/progress/progress';
import { audio } from '@engine/audio/audio';
import { EpisodeArt } from '../components/EpisodeArt';
import { FloorPlan } from '../components/FloorPlan';
import { Difficulty } from '../components/Difficulty';
import { CastChip } from '../components/CastChip';
import { Arrow, Check, Clock, Star } from '../components/Icons';

function fmtTime(t: number | null | undefined) {
  if (t == null) return '-';
  return `${Math.floor(t / 60)}:${Math.floor(t % 60)
    .toString()
    .padStart(2, '0')}`;
}

export function EpisodeSelect() {
  const episodes = allEpisodes();
  const save = useProgress((s) => s.save);
  const { episodeId, selectEpisode, goTo } = useGame();
  const [focus, setFocus] = useState(episodeId ?? episodes[0]?.id);
  const current = episodes.find((e) => e.id === focus) ?? episodes[0];
  const completedCount = episodes.filter((e) => Object.values(save.episodes[e.id]?.sides ?? {}).some((s) => s.completed)).length;
  const env = useMemo(() => (current ? getEnvironment(current.environment) : null), [current]);
  const choose = (id: string) => {
    const ep = episodes.find((e) => e.id === id)!;
    if (!isUnlocked(ep, save)) {
      audio.play('uiBack');
      setFocus(id);
      return;
    }
    audio.play('ui');
    selectEpisode(id);
    goTo('characters');
  };
  if (!current || !env) return null;
  const unlocked = isUnlocked(current, save);
  const prog = save.episodes[current.id];
  const comp = episodeCompletion(current, save);
  const needs = (current.unlock?.after ?? []).map((id) => episodes.find((e) => e.id === id)?.title ?? id);

  return (
    <main className="screen picker library">
      <div className="iris iris-dim" aria-hidden="true" />
      <header className="picker-head">
        <button className="btn btn-icon" aria-label="Back to main menu" onClick={() => (audio.play('uiBack'), goTo('menu'))}>
          <Arrow />
        </button>
        <h2 className="title-card">Episode library</h2>
        <p className="library-summary">
          {completedCount} of {episodes.length} episodes completed
        </p>
        <button className="btn btn-small" onClick={() => (audio.play('ui'), goTo('scrapbook'))}>
          Scrapbook
        </button>
      </header>
      <ul className="reel" role="list">
        {episodes.map((ep) => {
          const open = isUnlocked(ep, save);
          const c = episodeCompletion(ep, save);
          const done = c.sideDone > 0;
          return (
            <li key={ep.id}>
              <button
                className={`ep-card ${ep.id === current.id ? 'is-active' : ''} ${open ? '' : 'is-locked'}`}
                onMouseEnter={() => setFocus(ep.id)}
                onFocus={() => setFocus(ep.id)}
                onClick={() => choose(ep.id)}
                aria-label={`Episode ${ep.number}: ${ep.title}. ${open ? (done ? `Completed, ${c.percent}%` : 'Unlocked') : 'Locked'}`}
              >
                <EpisodeArt ep={ep} />
                {!open && <span className="ep-ribbon locked">Locked</span>}
                {open && done && (
                  <span className="ep-ribbon done">
                    <Check /> {c.percent}%
                  </span>
                )}
                {open && !done && !prog && <span className="ep-ribbon new">New</span>}
                <span className="ep-num">Episode {ep.number}</span>
                <span className="ep-title">{ep.title}</span>
                <span className="ep-tag">{ep.tagline}</span>
                <span className="ep-meta">
                  <Difficulty level={ep.difficulty} />
                  <span className="ep-time">
                    <Clock /> ~{ep.estimatedMinutes} min
                  </span>
                </span>
                <span className="ep-cast-row">
                  {ep.cast.map((cm) => (
                    <CastChip key={cm.characterId} id={cm.characterId} ai={!cm.playable} />
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <section className="ep-detail panel" aria-live="polite">
        <div className="ep-detail-main">
          <p className="ep-detail-title">
            Episode {current.number}: {current.title}
          </p>
          <p>{current.description}</p>
          {!unlocked && <p className="ep-lock-note">Finish {needs.join(' and ')} to unlock this episode.</p>}
          <div className="ep-sides">
            {current.cast
              .filter((c) => c.playable)
              .map((c) => {
                const sp = prog?.sides[c.characterId];
                const st = current.sides[c.characterId];
                return (
                  <div key={c.characterId} className={`ep-side ${sp?.completed ? 'done' : ''}`}>
                    <span className="ep-side-name">
                      {sp?.completed && <Check />} {getCharacter(c.characterId).name}
                    </span>
                    <span>Best {fmtTime(sp?.bestTime)}</span>
                    <span>
                      {st.stages ? `Mission ${Math.min((sp?.furthestStage ?? 0) + 1, st.stages.length)}/${st.stages.length}` : `${sp?.wins ?? 0} wins`}
                    </span>
                  </div>
                );
              })}
          </div>
          <button className="btn btn-primary" onClick={() => choose(current.id)} disabled={!unlocked} aria-disabled={!unlocked}>
            {unlocked ? (comp.sideDone ? 'Replay episode' : 'Play episode') : 'Locked'}
          </button>
        </div>
        <div className="ep-detail-map">
          <FloorPlan env={env} />
          <p className="ep-env-name">{env.name}</p>
        </div>
        <div className="ep-detail-goals">
          <p className="goals-head">
            Achievements {prog?.achievements.length ?? 0}/{current.achievements?.length ?? 0}
          </p>
          <ul className="goal-list">
            {(current.achievements ?? []).map((a) => (
              <li key={a.id} className={prog?.achievements.includes(a.id) ? 'done' : ''} title={a.description}>
                <Star /> <span>{a.title}</span>
              </li>
            ))}
          </ul>
          <p className="goals-head">Challenges</p>
          <ul className="goal-list">
            {(current.challenges ?? []).map((a) => (
              <li key={a.id} className={prog?.challenges.includes(a.id) ? 'done' : ''}>
                <Check /> <span>{a.description}</span>
              </li>
            ))}
          </ul>
          {(current.collectibles?.length ?? 0) > 0 && (
            <p className="goals-head">
              Golden thimbles {prog?.collectibles.length ?? 0}/{current.collectibles!.length}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
