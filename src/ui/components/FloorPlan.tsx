/**
 * Environment preview generated straight from the environment data: room floors, walls (with real
 * door / arch / mouse-hole gaps) and key zones. Any new environment gets a preview for free.
 */
import { useMemo } from 'react';
import type { EnvironmentDefinition } from '@engine/environment/types';
import { splitWall, wallDir } from '@engine/environment/geometry';

export function FloorPlan({ env, highlight = [] }: { env: EnvironmentDefinition; highlight?: string[] }) {
  const [x0, z0, x1, z1] = env.bounds;
  const w = x1 - x0;
  const h = z1 - z0;
  const segs = useMemo(() => {
    const out: { a: [number, number]; b: [number, number]; kind: string }[] = [];
    for (const wall of env.walls) {
      const len = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
      const [dx, dz] = wallDir(wall);
      for (const p of splitWall(len, wall.height ?? env.wallHeight, wall.openings)) {
        if (p.y0 > 0.01 || p.glass) continue;
        out.push({ a: [wall.from[0] + dx * p.u0, wall.from[1] + dz * p.u0], b: [wall.from[0] + dx * p.u1, wall.from[1] + dz * p.u1], kind: wall.kind ?? 'interior' });
      }
    }
    return out;
  }, [env]);
  return (
    <svg className="floorplan" viewBox={`${x0 - 1} ${z0 - 1} ${w + 2} ${h + 2}`} role="img" aria-label={`Map of ${env.name}`}>
      {env.rooms
        .slice()
        .sort((a, b) => (b.bounds[2] - b.bounds[0]) * (b.bounds[3] - b.bounds[1]) - (a.bounds[2] - a.bounds[0]) * (a.bounds[3] - a.bounds[1]))
        .map((r) => (
          <g key={r.id}>
            <rect x={r.bounds[0]} y={r.bounds[1]} width={r.bounds[2] - r.bounds[0]} height={r.bounds[3] - r.bounds[1]} fill={r.floorColor ?? '#b5733f'} opacity={r.outdoor ? 0.75 : 0.9} />
            {!r.outdoor && (
              <text x={(r.bounds[0] + r.bounds[2]) / 2} y={(r.bounds[1] + r.bounds[3]) / 2} className="fp-label" textAnchor="middle" dominantBaseline="middle">
                {r.name}
              </text>
            )}
          </g>
        ))}
      {segs.map((s, i) => (
        <line key={i} x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} className={`fp-wall fp-${s.kind}`} />
      ))}
      {env.zones
        .filter((z) => z.marker || highlight.includes(z.id))
        .map((z) => (
          <circle key={z.id} cx={z.center[0]} cy={z.center[2]} r={Math.max(0.6, z.radius * 0.8)} className="fp-zone" />
        ))}
    </svg>
  );
}
