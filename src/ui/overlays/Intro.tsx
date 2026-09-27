import { useState } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';

const BASE_URL = import.meta.env.BASE_URL;

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
        <div className="intro-art">
          <img className="intro-scene-img" src={`${BASE_URL}art/story/${scene.id}.webp`} alt="" />
          <div className="intro-caption">
            {form && <div className="mono label intro-form">{form}</div>}
            <p>{line}</p>
          </div>
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
