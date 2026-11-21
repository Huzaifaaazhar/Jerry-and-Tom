/** The game's title lettering - the one bold flourish of the visual identity. */
export function Logo({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const words = ['Squeak', '&', 'Pounce'];
  let i = 0;
  return (
    <h1 className={`logo logo-${size}`} aria-label="Squeak and Pounce">
      {words.map((w) => (
        <span key={w} className={`logo-word ${w === '&' ? 'logo-amp' : ''}`} aria-hidden="true">
          {w.split('').map((ch) => {
            const k = i++;
            return (
              <span key={k} className="logo-letter" style={{ ['--r' as string]: `${((k * 37) % 9) - 4}deg`, ['--y' as string]: `${((k * 53) % 7) - 3}px` }}>
                {ch}
              </span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}
