const LABEL = { 1: 'Easy', 2: 'Medium', 3: 'Hard' } as const;
export function Difficulty({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="difficulty" aria-label={`Difficulty: ${LABEL[level]}`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`diff-pip ${i <= level ? 'on' : ''}`} aria-hidden="true" />
      ))}
      <span>{LABEL[level]}</span>
    </span>
  );
}
