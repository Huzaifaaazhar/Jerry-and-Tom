import type { EpisodeDefinition } from '@engine/episode/types';

/** Procedural title-card art for an episode thumbnail (sky, motif, house silhouette). */
export function EpisodeArt({ ep }: { ep: EpisodeDefinition }) {
  const t = ep.thumbnail;
  if (t.image) return <img src={t.image} alt="" className="ep-art" />;
  const night = t.motif === 'moon';
  const windows = night ? '#f5c542' : '#9fd8e6';
  return (
    <svg className="ep-art" viewBox="0 0 320 180" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill={t.sky} />
      {[150, 120, 90, 60].map((r, i) => (
        <circle key={r} cx="250" cy="52" r={r} fill="none" stroke={night ? '#ffffff' : '#ffffff'} strokeOpacity={0.06 + i * 0.03} strokeWidth="14" />
      ))}
      {t.motif === 'moon' ? (
        <g>
          <circle cx="250" cy="50" r="26" fill="#fde9a9" />
          <circle cx="262" cy="42" r="22" fill={t.sky} />
          {[
            [40, 30],
            [90, 18],
            [150, 40],
            [205, 22],
            [300, 95],
          ].map(([x, y]) => (
            <circle key={`${x}`} cx={x} cy={y} r="2" fill="#fde9a9" />
          ))}
        </g>
      ) : (
        <g>
          <circle cx="250" cy="50" r="24" fill="#f5b92e" stroke="#2a1a12" strokeWidth="3" />
          {Array.from({ length: 10 }).map((_, k) => {
            const a = (k / 10) * Math.PI * 2;
            return <line key={k} x1={250 + Math.cos(a) * 32} y1={50 + Math.sin(a) * 32} x2={250 + Math.cos(a) * 42} y2={50 + Math.sin(a) * 42} stroke="#2a1a12" strokeWidth="3" strokeLinecap="round" />;
          })}
        </g>
      )}
      <path d="M0 150 Q80 128 160 142 T320 136 V180 H0 Z" fill={t.ground} />
      <g stroke="#2a1a12" strokeWidth="3" strokeLinejoin="round">
        <rect x="58" y="92" width="120" height="62" fill={night ? '#cfc2a0' : '#fff6dc'} />
        <path d="M48 96 L118 52 L188 96 Z" fill="#e0452b" />
        <rect x="74" y="108" width="22" height="20" fill={windows} />
        <rect x="140" y="108" width="22" height="20" fill={windows} />
        <rect x="106" y="118" width="22" height="36" fill="#7a4426" />
      </g>
      <path d="M118 154 a6 6 0 0 1 12 0 Z" fill="#2a1a12" />
      <g stroke="#2a1a12" strokeWidth="2.5">
        {Array.from({ length: 9 }).map((_, k) => (
          <rect key={k} x={196 + k * 13} y="126" width="9" height="30" fill="#fff6dc" />
        ))}
      </g>
    </svg>
  );
}
