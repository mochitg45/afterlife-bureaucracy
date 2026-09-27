import { useRef, useState } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';

const BASE_URL = import.meta.env.BASE_URL;
// One tap should move one scene: ignore any further taps for this long after one lands.
const TAP_GUARD_MS = 300;

/**
 * The opening cutscene, shown once on the first shift in place of the old memo dialogs.
 * Four scenes on a full-screen parchment stage: tapping anywhere on the stage, or the
 * button, advances — Skip and the last scene's CTA both end it. There is no auto-advance;
 * the player reads at their own pace.
 */
export function Intro() {
  const memosSeen = useGame((s) => s.state.onboarding.memosSeen);
  const markMemosSeen = useGame((s) => s.markMemosSeen);
  const [index, setIndex] = useState(0);
  const scenes = content.onboarding.intro;
  const lastAdvance = useRef(0);

  if (memosSeen || scenes.length === 0) return null;
  // Clamped rather than indexed raw: a content build with fewer scenes than a stale index
  // should show the last frame, not an empty stage.
  const at = Math.min(index, scenes.length - 1);
  const scene = scenes[at];
  const last = at >= scenes.length - 1;
  const advance = () => {
    const now = Date.now();
    if (now - lastAdvance.current < TAP_GUARD_MS) return;
    lastAdvance.current = now;
    last ? markMemosSeen() : setIndex(at + 1);
  };
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
            <span className="intro-hint" aria-hidden="true">Tap to continue</span>
          </div>
        </div>
        <button className="btn btn-primary intro-cta" onClick={(e) => { e.stopPropagation(); advance(); }}>
          {scene.cta ?? 'Next'}
        </button>
      </div>
    </div>
  );
}
