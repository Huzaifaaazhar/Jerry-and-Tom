import { useGame } from '@engine/core/store';
import { getEpisode } from '@engine/episode/registry';
import { audio } from '@engine/audio/audio';
import { Check, Cross, Star } from '../components/Icons';

export function Results() {
  const { result, restart, goTo, episodeId, characterId, selectCharacter, startRun, setStartStage } = useGame();
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
        {result.stages && result.stages.length > 0 && (
          <ol className="result-missions" aria-label="Missions">
            {result.stages.map((st) => (
              <li key={st.title} className={st.done ? 'done' : ''}>
                {st.title}
              </li>
            ))}
          </ol>
        )}
        <dl className="result-stats">
          {result.stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
        {result.rewards && (result.rewards.achievements.length > 0 || result.rewards.challenges.length > 0 || result.rewards.unlockedEpisodes.length > 0 || result.rewards.collectibles.newThisRun > 0) && (
          <ul className="result-rewards" aria-label="Rewards">
            {result.rewards.unlockedEpisodes.map((t) => (
              <li key={t} className="reward unlock">
                Episode unlocked: {t}
              </li>
            ))}
            {result.rewards.achievements.map((t) => (
              <li key={t} className="reward">
                <Star /> Achievement: {t}
              </li>
            ))}
            {result.rewards.challenges.map((t) => (
              <li key={t} className="reward">
                <Check /> Challenge complete: {t}
              </li>
            ))}
            {result.rewards.collectibles.newThisRun > 0 && (
              <li className="reward">
                Golden thimbles: {result.rewards.collectibles.found}/{result.rewards.collectibles.total}
              </li>
            )}
          </ul>
        )}
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
          <button className="btn btn-primary" autoFocus onClick={() => (audio.play('ui'), setStartStage(0), restart())}>
            Play again
          </button>
          {other && (
            <button
              className="btn"
              onClick={() => {
                audio.play('ui');
                selectCharacter(other.characterId);
                setStartStage(0);
                startRun();
              }}
            >
              Switch sides
            </button>
          )}
          <button className="btn" onClick={() => (audio.play('uiBack'), goTo('episodes'))}>
            Episode library
          </button>
        </div>
      </div>
    </div>
  );
}
