import { useState } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { Character } from '../characters/Character';
import { StampSeal } from '../components/StampButton';

const INK = 'var(--ink)';

/** Dusk over the mortal world: flat ink skyline, a bed, and the soul that has just left it. */
function SceneEnd() {
  return (
    <div className="intro-art">
      <svg className="intro-back" viewBox="0 0 200 140" aria-hidden="true">
        <rect x="0" y="0" width="200" height="140" fill="var(--surface-2)" />
        <circle cx="162" cy="32" r="15" fill="var(--brass)" stroke={INK} strokeWidth="2.5" />
        <path
          d="M0 98 h20 v-28 h16 v16 h14 v-38 h18 v50 h16 v-24 h20 v24 h18 v-42 h16 v42 h24 v-16 h18 v16 H0 Z"
          fill="var(--green)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round"
        />
        <rect x="-2" y="98" width="204" height="44" fill="var(--paper)" stroke={INK} strokeWidth="2.5" />
        <rect x="58" y="114" width="76" height="16" rx="3" fill="var(--surface)" stroke={INK} strokeWidth="2.5" />
        <rect x="50" y="104" width="16" height="26" rx="3" fill="var(--surface-2)" stroke={INK} strokeWidth="2.5" />
      </svg>
      <div className="intro-rise"><Character id="soul" mood="ok" size={54} /></div>
    </div>
  );
}

/** The counter: a queue running off the left edge, the sign, and a ticker that rolls over. */
function SceneQueue() {
  return (
    <div className="intro-art">
      <svg className="intro-back" viewBox="0 0 200 140" aria-hidden="true">
        <rect x="0" y="0" width="200" height="140" fill="var(--surface-2)" />
        <rect x="112" y="14" width="80" height="30" rx="3" fill="var(--green)" stroke={INK} strokeWidth="2.5" />
        <text x="152" y="34" textAnchor="middle" fill="var(--paper)" fontFamily="var(--font-display)" fontSize="13">INTAKE</text>
        <rect x="-2" y="96" width="204" height="46" fill="var(--paper)" stroke={INK} strokeWidth="2.5" />
        <rect x="118" y="82" width="86" height="20" rx="2" fill="var(--surface)" stroke={INK} strokeWidth="2.5" />
      </svg>
      <div className="intro-queue">
        {['a', 'b', 'c', 'd', 'e'].map((k) => <Character key={k} id="soul" mood="ok" size={38} />)}
      </div>
      <div className="intro-ticker mono">
        <span className="label">Now serving</span>
        <span className="intro-roll"><b>0000006</b><b>0000007</b></span>
      </div>
    </div>
  );
}

/** Dave slides the stamp across the desk while Seraphine holds up the offer. */
function SceneOffer() {
  return (
    <div className="intro-art">
      <svg className="intro-back" viewBox="0 0 200 140" aria-hidden="true">
        <rect x="0" y="0" width="200" height="140" fill="var(--surface-2)" />
        <rect x="-2" y="92" width="204" height="50" fill="var(--paper)" stroke={INK} strokeWidth="2.5" />
        <rect x="14" y="92" width="172" height="12" fill="var(--surface)" stroke={INK} strokeWidth="2.5" />
      </svg>
      <div className="intro-desk">
        <Character id="dave" mood="ok" size={62} />
        <Character id="seraphine" mood="ok" size={62} />
      </div>
      <svg className="intro-form-2c" viewBox="0 0 40 52" aria-hidden="true">
        <rect x="2" y="2" width="36" height="48" rx="2" fill="var(--surface)" stroke={INK} strokeWidth="2.5" />
        <path d="M8 16 h24 M8 24 h24 M8 32 h16" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        <text x="20" y="11" textAnchor="middle" fill={INK} fontFamily="var(--font-mono)" fontSize="6">2-C</text>
      </svg>
      <StampSeal className="intro-slide" size={44} />
    </div>
  );
}

/** The first stamp: the seal lands, the paper jolts, the ink goes everywhere. */
function SceneStamp() {
  return (
    <div className="intro-art intro-jolt">
      <svg className="intro-back" viewBox="0 0 200 140" aria-hidden="true">
        <rect x="24" y="14" width="152" height="112" rx="3" fill="var(--surface)" stroke={INK} strokeWidth="2.5" />
        <path d="M42 36 h116 M42 48 h116 M42 60 h72" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <StampSeal className="intro-slam" size={92} />
      {[0, 1, 2, 3, 4].map((i) => <span key={i} className={'intro-splat s' + i} />)}
    </div>
  );
}

const SCENES = [SceneEnd, SceneQueue, SceneOffer, SceneStamp];

/**
 * The opening cutscene, shown once on the first shift in place of the old memo dialogs.
 * Four scenes on a full-screen parchment stage: tapping anywhere, the button, or letting a
 * scene's pacing animation run out advances; Skip and the last scene's CTA both end it.
 *
 * The pacing is a CSS animation rather than a timer — an invisible element whose delay
 * covers the scene's own animation and whose `animationend` advances — so a `prefers-
 * reduced-motion` player gets four still frames that only move when they ask them to.
 */
export function Intro() {
  const memosSeen = useGame((s) => s.state.onboarding.memosSeen);
  const markMemosSeen = useGame((s) => s.markMemosSeen);
  const [index, setIndex] = useState(0);
  const scenes = content.onboarding.intro;

  if (memosSeen || scenes.length === 0) return null;
  // Clamped rather than indexed raw: a content build with fewer scenes than a stale index
  // should show the last frame, not an empty stage.
  const at = Math.min(index, scenes.length - 1);
  const scene = scenes[at];
  const Art = SCENES[Math.min(at, SCENES.length - 1)];
  const last = at >= scenes.length - 1;
  const advance = () => (last ? markMemosSeen() : setIndex(at + 1));
  // Everything before the em dash is the form number, set in the typewriter face above the line.
  const [form, line] = scene.caption.includes(' — ') ? scene.caption.split(' — ') : [null, scene.caption];

  return (
    <div className="intro" role="dialog" aria-label="Introduction" onClick={advance}>
      <button
        className="btn btn-ghost intro-skip"
        onClick={(e) => { e.stopPropagation(); markMemosSeen(); }}
      >
        Skip
      </button>
      <div className="intro-stage" key={scene.id}>
        <Art />
        <div className="intro-caption">
          {form && <div className="mono label intro-form">{form}</div>}
          <p>{line}</p>
        </div>
        <button className="btn btn-primary intro-cta" onClick={(e) => { e.stopPropagation(); advance(); }}>
          {scene.cta ?? 'Next'}
        </button>
        {/* The pacer. Its delay covers the scene animation, its duration is the 2.5s hold.
            Never mounted on the last scene: the intro must end on a deliberate press, not on
            a hold running out while the player reads the CTA. */}
        {!last && <span className="intro-timer" data-testid="intro-timer" onAnimationEnd={advance} />}
      </div>
    </div>
  );
}
