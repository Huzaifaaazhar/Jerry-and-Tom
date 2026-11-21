import { useState } from 'react';
import { useGame } from '@engine/core/store';
import { allEpisodes } from '@engine/episode/registry';
import { getCharacter } from '@engine/characters/registry';
import { audio } from '@engine/audio/audio';
import { EpisodeArt } from '../components/EpisodeArt';
import { Arrow } from '../components/Icons';

export function EpisodeSelect() {
  const episodes = allEpisodes();
  const { episodeId, selectEpisode, goTo } = useGame();
  const [focus, setFocus] = useState(episodeId ?? episodes[0]?.id);
  const current = episodes.find((e) => e.id === focus) ?? episodes[0];
  const choose = (id: string) => {
    audio.play('ui');
    selectEpisode(id);
    goTo('characters');
  };
  return (
    <main className="screen picker">
      <div className="iris iris-dim" aria-hidden="true" />
      <header className="picker-head">
        <button className="btn btn-icon" aria-label="Back to main menu" onClick={() => (audio.play('uiBack'), goTo('menu'))}>
          <Arrow />
        </button>
        <h2 className="title-card">Pick an episode</h2>
      </header>
      <ul className="reel" role="list">
        {episodes.map((ep) => (
          <li key={ep.id}>
            <button
              className={`ep-card ${ep.id === current?.id ? 'is-active' : ''}`}
              onMouseEnter={() => setFocus(ep.id)}
              onFocus={() => setFocus(ep.id)}
              onClick={() => choose(ep.id)}
              aria-describedby={`ep-${ep.id}-desc`}
            >
              <EpisodeArt ep={ep} />
              <span className="ep-num">Episode {ep.number}</span>
              <span className="ep-title">{ep.title}</span>
              <span className="ep-tag">{ep.tagline}</span>
            </button>
          </li>
        ))}
        <li className="ep-soon" aria-label="More episodes coming">
          <span>More episodes on the way</span>
        </li>
      </ul>
      {current && (
        <section className="ep-detail panel" id={`ep-${current.id}-desc`}>
          <p>{current.description}</p>
          <p className="ep-cast">
            Starring{' '}
            {current.cast.map((c, i) => (
              <span key={c.characterId}>
                <strong>{getCharacter(c.characterId).name}</strong>
                {c.playable ? '' : ' (AI)'}
                {i < current.cast.length - 2 ? ', ' : i === current.cast.length - 2 ? ' and ' : ''}
              </span>
            ))}
          </p>
          <button className="btn btn-primary" onClick={() => choose(current.id)}>
            Choose a side
          </button>
        </section>
      )}
    </main>
  );
}
