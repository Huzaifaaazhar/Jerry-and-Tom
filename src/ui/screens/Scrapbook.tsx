import { useState } from 'react';
import { useGame } from '@engine/core/store';
import { allEpisodes } from '@engine/episode/registry';
import { allCharacters } from '@engine/characters/registry';
import { useProgress } from '@engine/progress/progress';
import { allLifetimeAchievements } from '@engine/progress/achievements';
import { audio } from '@engine/audio/audio';
import { Arrow, Star } from '../components/Icons';

const STAT_LABELS: [string, string][] = [
  ['plays', 'Episodes played'],
  ['wins', 'Episodes won'],
  ['catch', 'Catches'],
  ['caught', 'Times caught'],
  ['nearMiss', 'Last-second escapes'],
  ['hide', 'Times hidden'],
  ['found', 'Hiding mice found'],
  ['slipped', 'Slips'],
  ['splat', 'Face-plants'],
  ['pummeled', 'Bulldog wallopings'],
  ['slam', 'Doors slammed'],
  ['broken', 'Barricades smashed'],
  ['pickup', 'Snacks collected'],
];

export function Scrapbook() {
  const goTo = useGame((s) => s.goTo);
  const { save, reset } = useProgress();
  const [confirm, setConfirm] = useState(false);
  const players = allCharacters().filter((c) => allEpisodes().some((e) => e.cast.some((m) => m.characterId === c.id && m.playable)));
  const lifetime = allLifetimeAchievements();
  return (
    <main className="screen picker">
      <div className="iris iris-dim" aria-hidden="true" />
      <header className="picker-head">
        <button className="btn btn-icon" aria-label="Back to episodes" onClick={() => (audio.play('uiBack'), goTo('episodes'))}>
          <Arrow />
        </button>
        <h2 className="title-card">Scrapbook</h2>
      </header>
      <div className="scrapbook">
        {players.map((c) => {
          const st = save.stats[c.id] ?? {};
          const mine = lifetime.filter((a) => a.characterId === c.id);
          return (
            <section key={c.id} className="panel scrap-card" style={{ ['--char' as string]: c.ui.color }}>
              <h3 className="scrap-name">{c.name}</h3>
              <dl className="scrap-stats">
                {STAT_LABELS.filter(([k]) => st[k] !== undefined || k === 'plays').map(([k, label]) => (
                  <div key={k}>
                    <dt>{label}</dt>
                    <dd>{st[k] ?? 0}</dd>
                  </div>
                ))}
              </dl>
              <p className="goals-head">
                Achievements {mine.filter((a) => save.achievements.includes(a.id)).length}/{mine.length}
              </p>
              <ul className="goal-list">
                {mine.map((a) => {
                  const done = save.achievements.includes(a.id);
                  const have = Math.min(a.count, st[a.stat] ?? 0);
                  return (
                    <li key={a.id} className={done ? 'done' : ''}>
                      <Star />
                      <span>
                        <strong>{a.title}</strong> - {a.description} {!done && `(${have}/${a.count})`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        <section className="panel scrap-card">
          <h3 className="scrap-name">Save data</h3>
          <p>Progress saves automatically on this device after every episode.</p>
          {!confirm ? (
            <button className="btn" onClick={() => setConfirm(true)}>
              Reset progress
            </button>
          ) : (
            <div className="confirm-row">
              <span>Erase all progress, unlocks and achievements?</span>
              <button
                className="btn btn-danger"
                onClick={() => {
                  reset();
                  setConfirm(false);
                  audio.play('uiBack');
                }}
              >
                Erase everything
              </button>
              <button className="btn" onClick={() => setConfirm(false)}>
                Keep my progress
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
