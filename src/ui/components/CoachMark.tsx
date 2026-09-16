import { useEffect, useState, type ReactNode } from 'react';
import type { CoachTarget } from '../../engine/content';

interface Hole { top: number; left: number; width: number; height: number; card: { top?: string; bottom?: string }; above: boolean }

/** Gap between the spotlight and the card. */
const GAP = 16;
/**
 * Room the card needs under a target before it is worth putting it there: roughly the card
 * itself plus the tab bar. Dave's Hire row sits just above the tab bar, so step 1 would
 * otherwise push its Skip button off the bottom of the screen.
 */
const ROOM_BELOW = 220;

/**
 * Whether a measured target is somewhere the player can actually see. A row that has been
 * scrolled past is still in the DOM and still answers `getBoundingClientRect()` with a real
 * box, just one outside the viewport — spotlighting it would draw the hole off-screen and
 * push the card's own Skip button off with it.
 */
function onScreen(r: DOMRect): boolean {
  // A target with no box yet is a screen still laying out, not a target somewhere else.
  if (r.width === 0 || r.height === 0) return false;
  return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
}

/**
 * One step of the walkthrough: a dimmed office with a hole cut over the control the player
 * is being asked to press, and a card explaining why.
 *
 * The dimming is a single `box-shadow` spread on the hole rather than four edge panels, so
 * there is exactly one element to position and no seams between them. The overlay itself
 * takes no pointer events and only the card takes them back, which is what lets the tap the
 * card is asking for land on the real stamp or hire button underneath.
 */
export function CoachMark({
  target,
  title,
  text,
  stepIndex,
  total,
  onSkip,
  children,
}: {
  target: CoachTarget;
  title: string;
  text: string;
  stepIndex: number;
  total: number;
  onSkip: () => void;
  /** An extra action beside Skip — the recap step's "Got it". */
  children?: ReactNode;
}) {
  const [hole, setHole] = useState<Hole | null>(null);

  // Re-measured on resize because a rotation or a keyboard moves the target out from under
  // a hole that was measured against the old viewport.
  useEffect(() => {
    if (target === 'none') {
      setHole(null);
      return;
    }
    const find = () => document.querySelector<HTMLElement>(`[data-coach="${target}"]`);
    const measure = () => {
      const el = find();
      if (!el) {
        setHole(null);
        return;
      }
      const r = el.getBoundingClientRect();
      // Nothing to spotlight that the player can see: centre the card instead of cutting a
      // hole in a part of the page that is not on screen.
      if (!onScreen(r)) {
        setHole(null);
        return;
      }
      const above = window.innerHeight - r.bottom < ROOM_BELOW;
      setHole({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        above,
        // Anchored by whichever edge faces the target, so the card sizes itself to its copy
        // without anyone having to measure it first.
        card: above ? { bottom: window.innerHeight - r.top + GAP + 'px' } : { top: r.bottom + GAP + 'px' },
      });
    };
    // Bring the target into view before the first measurement, so a step whose control has
    // been scrolled past gets a real spotlight rather than the centred fallback. Only here,
    // never on resize: yanking the page around while someone is rotating the phone or has a
    // keyboard open would be the walkthrough fighting them. Optional-called because jsdom
    // does not implement it.
    find()?.scrollIntoView?.({ block: 'center', behavior: 'auto' });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [target]);

  return (
    <div className="coach-overlay">
      {/* With nothing to spotlight the hole's own box-shadow cannot do the dimming, so the
          recap gets a plain scrim and the same weight on screen as the two steps before it. */}
      {!hole && <div className="coach-dim" />}
      {hole && (
        <div
          className="coach-hole"
          style={{ top: hole.top + 'px', left: hole.left + 'px', width: hole.width + 'px', height: hole.height + 'px' }}
        >
          <span className="coach-ring" />
        </div>
      )}
      <div
        className={'coach-card card' + (hole ? (hole.above ? ' above' : '') : ' centred')}
        style={hole?.card}
        // Deliberately not a dialog: a dialog would trap focus and take the next tap, and
        // this card exists to send that tap to the real button showing through the hole.
        role="region"
        aria-label={title}
        aria-live="polite"
      >
        <div className="label mono">Step {stepIndex + 1} of {total}</div>
        <h3 className="coach-title">{title}</h3>
        <p className="sub coach-text">{text}</p>
        <div className="coach-actions">
          {children}
          <button className="btn btn-ghost coach-skip" onClick={onSkip}>Skip</button>
        </div>
      </div>
    </div>
  );
}
