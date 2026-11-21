import { useGame } from '@engine/core/store';
import { getEpisode } from '@engine/episode/registry';
import { audio } from '@engine/audio/audio';
import { Check, Cross } from '../components/Icons';

export function Results() {
  const { result, restart, goTo, episodeId, characterId, selectCharacter, startRun } = useGame();
  if (!result) return null;
  const ep = getEpisode(episodeId!);
  const other = ep.cast.find((c) => c.playable && c.characterId !== characterId);
  const win = result.outcome === 'win';
  return (
    <div className={`overlay results ${win ? 'is-win' : 'is-lose'}`} role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className="iris iris-results" aria-hidden="true" />
      <div className="result-card panel">
        <p className="result-kicker">{win ? 'You win' : 'You lose'}</p>
        <h2 id="result-title" className="title-card result-title">
          {result.title}
        </h2>
        <p className="result-caption">{result.caption}</p>
        <dl className="result-stats">
          {result.stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
        {result.bonus.length > 0 && (
          <ul className="result-bonus" aria-label="Bonus goals">
            {result.bonus.map((b) => (
              <li key={b.label} className={b.done ? 'done' : ''}>
                {b.done ? <Check /> : <Cross />}
                <span>{b.label}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="result-actions">
          <button className="btn btn-primary" autoFocus onClick={() => (audio.play('ui'), restart())}>
            Play again
          </button>
          {other && (
            <button
              className="btn"
              onClick={() => {
                audio.play('ui');
                selectCharacter(other.characterId);
                startRun();
              }}
            >
              Switch sides
            </button>
          )}
          <button className="btn" onClick={() => (audio.play('uiBack'), goTo('episodes'))}>
            Episodes
          </button>
        </div>
      </div>
    </div>
  );
}
