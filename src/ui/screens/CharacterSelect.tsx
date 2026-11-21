import { useState } from 'react';
import { useGame } from '@engine/core/store';
import { getEpisode } from '@engine/episode/registry';
import { getCharacter } from '@engine/characters/registry';
import { audio } from '@engine/audio/audio';
import { Stage } from '../components/Stage';
import { Arrow, Bolt, ITEM_ICONS, Laugh } from '../components/Icons';

export function CharacterSelect() {
  const { episodeId, characterId, selectCharacter, goTo, startRun } = useGame();
  const ep = getEpisode(episodeId!);
  const playable = ep.cast.filter((c) => c.playable);
  const npcs = ep.cast.filter((c) => !c.playable);
  const [pick, setPick] = useState(characterId && playable.some((p) => p.characterId === characterId) ? characterId : playable[0].characterId);
  const def = getCharacter(pick);
  const side = ep.sides[pick];
  const trapKind = Object.keys(side.charges ?? {})[0] ?? def.trap?.kind;
  const TrapIcon = trapKind ? ITEM_ICONS[trapKind] : null;
  const start = () => {
    audio.unlock();
    audio.play('ui');
    selectCharacter(pick);
    startRun();
  };
  const cast = playable.map((c, i) => ({ id: c.characterId, x: (i - (playable.length - 1) / 2) * 2.6, z: 0, facing: i === 0 ? 0.6 : -0.6 }));
  return (
    <main className="screen picker">
      <div className="iris iris-dim" aria-hidden="true" />
      <header className="picker-head">
        <button className="btn btn-icon" aria-label="Back to episodes" onClick={() => (audio.play('uiBack'), goTo('episodes'))}>
          <Arrow />
        </button>
        <h2 className="title-card">
          {ep.title}: who are you?
        </h2>
      </header>
      <div className="char-stage">
        <Stage cast={cast} highlight={pick} camera={[0.8, 1.7, 7.2]} target={[1.2, 0.5, 0]} />
      </div>
      <div className="char-choices" role="radiogroup" aria-label="Choose your character">
        {playable.map((c) => {
          const d = getCharacter(c.characterId);
          const active = c.characterId === pick;
          return (
            <button
              key={c.characterId}
              role="radio"
              aria-checked={active}
              className={`char-chip ${active ? 'is-active' : ''}`}
              style={{ ['--char' as string]: d.ui.color, ['--char-accent' as string]: d.ui.accent }}
              onClick={() => (audio.play('ui'), setPick(c.characterId))}
            >
              <span className="char-name">{d.name}</span>
              <span className="char-species">{d.species}</span>
            </button>
          );
        })}
      </div>
      <section className="char-card panel" aria-live="polite">
        <p className="char-tagline">{def.tagline}</p>
        <p className="char-brief">{side.brief}</p>
        <ul className="char-abilities">
          {def.ability && (
            <li>
              {def.ability === 'pounce' ? <Bolt /> : <Laugh />}
              <span>
                <kbd>F</kbd> {def.ability === 'pounce' ? 'Pounce - lunge and grab' : 'Taunt - lure the cat into trouble'}
              </span>
            </li>
          )}
          {TrapIcon && trapKind && (
            <li>
              <TrapIcon />
              <span>
                <kbd>Q</kbd> Drop a {trapKind === 'bananaPeel' ? 'banana peel' : 'mousetrap'} ×{side.charges?.[trapKind] ?? def.trap?.charges}
              </span>
            </li>
          )}
          <li>
            <span className="key-wide">
              <kbd>E</kbd>
            </span>
            <span>{def.archetype === 'prey' ? 'Hide in furniture, slip through mouse holes' : 'Open doors, search hiding places, grab'}</span>
          </li>
        </ul>
        {npcs.length > 0 && (
          <p className="char-npc">
            Also on set: {npcs.map((n) => getCharacter(n.characterId).name).join(', ')} - {getCharacter(npcs[0].characterId).tagline.toLowerCase()}
          </p>
        )}
        <button className="btn btn-primary btn-xl" onClick={start}>
          Play as {def.name}
        </button>
      </section>
    </main>
  );
}
