import { useState } from 'react';
import { useGame } from '../../store/game';
import type { GameState } from '../../engine/state';
import { formatNumber } from '../../engine/format';

interface Float { id: number; x: number; text: string }

const DEPT_ART = new Set(['intake', 'heaven', 'hell', 'reincarnation', 'limbo', 'valhalla']);

function deptSceneUrl(deptId: GameState['activeDept']) {
  const file = DEPT_ART.has(deptId) ? deptId : 'intake';
  return `${import.meta.env.BASE_URL}art/depts/${file}.webp`;
}

/**
 * The stamp's seal, without the button around it. The title screen shows the same seal as
 * artwork, so the drawing lives here once and the button is one of its two callers.
 */
export function StampSeal({ className, size = 120 }: { className?: string; size?: number }) {
  return (
    <svg className={className} viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <circle cx="60" cy="60" r="54" fill="var(--red)" stroke="var(--ink)" strokeWidth="4" />
      <circle cx="60" cy="60" r="42" fill="none" stroke="var(--surface)" strokeWidth="3" strokeDasharray="6 5" />
      <text x="60" y="56" textAnchor="middle" fill="var(--surface)" fontFamily="var(--font-display)" fontSize="18">PROCESSED</text>
      <text x="60" y="76" textAnchor="middle" fill="var(--surface)" fontFamily="var(--font-mono)" fontSize="12">FORM 7-B</text>
    </svg>
  );
}

/**
 * Ambient motion per department scene: each glow sits on a light painted in that scene
 * ([left %, top %, size %]) and dims and brightens on its own beat; `beam` adds Heaven's
 * window shaft. Positions were read off the 768px art.
 */
type SceneFx = { kind: 'dust' | 'sparkle' | 'ember'; glows: [number, number, number][]; beam?: boolean };
const SCENE_FX: Record<string, SceneFx> = {
  // three pendant bulbs
  intake: { kind: 'dust', glows: [[23, 20, 22], [51, 24.5, 22], [90, 29, 22]] },
  // window, then the three ring lamps
  heaven: { kind: 'sparkle', beam: true, glows: [[73, 15, 34], [23, 18, 18], [51, 27, 18], [91, 33, 18]] },
  // three lanterns, the furnace mouth, the four wall grilles
  hell: { kind: 'ember', glows: [[23, 20, 20], [51, 24, 20], [90, 29, 20], [27, 33, 26], [9, 8, 14], [34, 8, 14], [56, 8, 14], [94, 8.5, 14]] },
  reincarnation: { kind: 'sparkle', glows: [] },
  limbo: { kind: 'dust', glows: [] },
  valhalla: { kind: 'ember', glows: [] },
};
/** [left %, delay s, duration s], fixed so re-renders keep the same particles. */
const PARTICLES: [number, number, number][] = [
  [8, 0, 7], [19, 2.4, 8.5], [31, 1.1, 6.5], [44, 3.6, 9], [57, 0.6, 7.5], [66, 4.2, 8],
  [74, 1.8, 6.8], [83, 3, 9.5], [92, 0.3, 7.2], [38, 5, 8.2],
];

export function StampButton() {
  const stamp = useGame((s) => s.stamp);
  const rotateQueue = useGame((s) => s.rotateQueue);
  const clickPower = useGame((s) => s.rates.clickPower);
  const activeDept = useGame((s) => s.state.activeDept);
  const [floats, setFloats] = useState<Float[]>([]);
  const [pressed, setPressed] = useState(false);

  const onStamp = () => {
    stamp();
    rotateQueue();
    setPressed(true);
    setTimeout(() => setPressed(false), 90);
    const f = { id: Date.now() + Math.random(), x: 30 + Math.random() * 40, text: '+' + formatNumber(clickPower) };
    setFloats((cur) => [...cur.slice(-6), f]);
    setTimeout(() => setFloats((cur) => cur.filter((x) => x.id !== f.id)), 700);
  };

  const fx = SCENE_FX[activeDept] ?? SCENE_FX.intake;
  return (
    <div className="stamp-wrap">
      <div className="stamp-scene" data-testid="stamp-scene" style={{ backgroundImage: `url(${deptSceneUrl(activeDept)})` }}>
        <div className={'scene-fx scene-' + fx.kind} aria-hidden="true">
          {fx.beam && <span className="fx-beam" />}
          {fx.glows.map(([x, y, size], i) => <span key={'g' + i} className="fx-lamp" style={{ left: `${x}%`, top: `${y}%`, width: `${size}%`, animationDelay: `${i * -1.3}s` }} />)}
          {PARTICLES.map(([x, delay, dur], i) => <span key={'p' + i} className="fx-dot" style={{ left: `${x}%`, animationDelay: `${delay}s`, animationDuration: `${dur}s` }} />)}
        </div>
        {floats.map((f) => <span key={f.id} className="float mono" style={{ left: f.x + '%' }}>{f.text}</span>)}
        <button className={'stamp' + (pressed ? ' pressed' : '')} onPointerDown={onStamp} aria-label="Stamp soul" data-coach="stamp">
          <StampSeal />
        </button>
        <div className="mono sub stamp-scene-pill">+{formatNumber(clickPower)} per stamp</div>
      </div>
    </div>
  );
}
