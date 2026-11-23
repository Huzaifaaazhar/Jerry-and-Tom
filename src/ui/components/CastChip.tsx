import { getCharacter } from '@engine/characters/registry';

/** Small character badge used on episode cards (colour-coded initial + name). */
export function CastChip({ id, ai }: { id: string; ai?: boolean }) {
  const d = getCharacter(id);
  return (
    <span className="cast-chip" style={{ ['--char' as string]: d.ui.color, ['--char-accent' as string]: d.ui.accent }}>
      <span className="cast-face" aria-hidden="true">
        {d.name[0]}
      </span>
      {d.name}
      {ai ? <span className="cast-ai">AI</span> : null}
    </span>
  );
}
