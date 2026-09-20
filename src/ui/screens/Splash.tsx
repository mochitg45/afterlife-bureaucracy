import { useEffect, useMemo, useRef } from 'react';

const CX = 256;
const CY = 310;
const R = 104;
const RAY_COUNT = 28;
const FACET_COUNT = 12;
const PALETTE = ['#ffb100', '#ff8a1f', '#f2652b', '#ffcf33', '#ff9d2e', '#ffc41f', '#f4741f'];

interface Ray { x1: number; y1: number; x2: number; y2: number; delay: number; }
interface Facet { points: string; fill: string; delay: number; }

/** 28 rays and the 12-point faceted disc, built once — the same geometry as the approved mockup. */
function buildGeometry(): { rays: Ray[]; facets: Facet[] } {
  const rays: Ray[] = [];
  for (let i = 0; i < RAY_COUNT; i++) {
    const a = (i / RAY_COUNT) * Math.PI * 2 - Math.PI / 2;
    const long = i % 2 === 0;
    const r1 = R + 22;
    const r2 = R + (long ? 74 : 52);
    rays.push({
      x1: CX + Math.cos(a) * r1, y1: CY + Math.sin(a) * r1,
      x2: CX + Math.cos(a) * r2, y2: CY + Math.sin(a) * r2,
      delay: 0.15 + i * 0.03,
    });
  }

  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let i = 0; i < FACET_COUNT; i++) {
    const a = (i / FACET_COUNT) * Math.PI * 2;
    outer.push([CX + Math.cos(a) * R, CY + Math.sin(a) * R]);
    const jitter = 0.5 + ((i * 7) % 5) * 0.06;
    inner.push([CX + Math.cos(a + 0.26) * R * jitter, CY + Math.sin(a + 0.26) * R * jitter]);
  }
  const tris: [number, number][][] = [];
  for (let i = 0; i < FACET_COUNT; i++) {
    const j = (i + 1) % FACET_COUNT;
    tris.push([outer[i], outer[j], inner[i]]);
    tris.push([outer[j], inner[j], inner[i]]);
    tris.push([inner[i], inner[j], [CX, CY]]);
  }
  const facets: Facet[] = tris.map((t, k) => {
    const fx = (t[0][0] + t[1][0] + t[2][0]) / 3;
    const fy = (t[0][1] + t[1][1] + t[2][1]) / 3;
    const d = Math.hypot(fx - CX, fy - CY) / R;
    return {
      points: t.map((p) => p.join(',')).join(' '),
      fill: PALETTE[(k * 5 + Math.floor(k / 3)) % PALETTE.length],
      delay: 0.95 + d * 0.5 + (k % 4) * 0.04,
    };
  });

  return { rays, facets };
}

/**
 * The Inata Sun Soft splash, shown once on every cold boot before the title screen. Rays
 * sweep in, the sun's facets light up, the name settles on its arc above them, then App moves
 * on. `boot()` keeps running underneath — this is a pure overlay, not a gate on it.
 *
 * Timed by the `.splash-stage`'s own CSS animation rather than a JS timer, so a tap, a key,
 * or the animation's own end all funnel through the same `finish()` — guarded so only the
 * first of them fires `onDone`. Under `prefers-reduced-motion` the stage's hold collapses to
 * a near-zero duration in CSS: the finished frame shows immediately, and its animationend
 * still calls `onDone` the same way a full run does.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const geometry = useMemo(buildGeometry, []);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    document.addEventListener('keydown', finish);
    return () => document.removeEventListener('keydown', finish);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="splash" data-testid="splash" onClick={finish}>
      <div
        className="splash-stage"
        data-testid="splash-stage"
        onAnimationEnd={(e) => { if (e.target === e.currentTarget) finish(); }}
      >
        <svg viewBox="0 0 512 512" aria-label="Inata Sun Soft">
          <defs>
            <path id="splash-arc" d="M 26 310 A 230 230 0 0 1 486 310" fill="none" />
            <clipPath id="splash-disc"><circle cx={CX} cy={CY} r={R} /></clipPath>
          </defs>
          <g>
            {geometry.rays.map((r, i) => (
              <line
                key={i} className="splash-ray"
                x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
                style={{ animationDelay: `${r.delay}s` }}
              />
            ))}
          </g>
          <circle className="splash-glow" cx={CX} cy={CY} r={110} />
          <g clipPath="url(#splash-disc)">
            <circle className="splash-facet" cx={CX} cy={CY} r={R} fill="#ff9d2e" style={{ animationDelay: '0.9s' }} />
            {geometry.facets.map((f, i) => (
              <polygon key={i} className="splash-facet" points={f.points} fill={f.fill} style={{ animationDelay: `${f.delay}s` }} />
            ))}
          </g>
          <text className="splash-word" textAnchor="middle">
            <textPath href="#splash-arc" startOffset="50%">INATA SUN SOFT</textPath>
          </text>
        </svg>
      </div>
    </div>
  );
}
