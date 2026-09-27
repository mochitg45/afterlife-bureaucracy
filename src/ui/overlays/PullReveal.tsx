import { useEffect, useState, type CSSProperties } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { findCard } from '../../engine/content';
import { formatNumber } from '../../engine/format';
import type { PullResult } from '../../engine/gacha';
import { CardTile } from '../components/CardTile';
import { Modal } from '../components/Modal';
import { KarmaIcon } from '../icons/Currency';
import './PullReveal.css';

/**
 * Reveal timeline (ms). Must stay in step with PullReveal.css: the form slides up, the stamp
 * lands at STAMP_HIT_MS, and the first card starts at CARDS_START_MS -- the whole opening beat
 * is under 700ms. Cards then follow STAGGER_MS apart and take CARD_MS each.
 */
const STAMP_HIT_MS = 330;
const CARDS_START_MS = 560;
const STAGGER_MS = 70;
const CARD_MS = 520; // card flip plus the NEW stamp that lands after it
const REDUCED_MS = 220;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** New card (first copy) vs. a star-up vs. a banked shard vs. a duplicate converted to Karma Coins. */
function resultLabel(r: PullResult) {
  if (r.duplicateKc) {
    return (
      <span className="amt">
        +{formatNumber(r.duplicateKc)} <KarmaIcon size={12} />
        <span className="visually-hidden">KC</span>
      </span>
    );
  }
  if (r.spareGained) return '+1 spare copy';
  if (r.starsAfter === 1) return <span className="reveal-new">NEW</span>;
  if (r.shards === 0) return `★ ${r.starsAfter}`;
  return `+1 (${r.shards}/${r.shardsNeeded})`;
}

function glowClass(r: PullResult): string {
  if (r.rarity === 'executive') return ' foil glow-exec';
  if (r.rarity === 'senior') return ' glow-senior';
  return '';
}

export function PullReveal() {
  const pendingPull = useGame((s) => s.pendingPull);
  if (!pendingPull) return null;
  // Unmounted between pulls (pendingPull goes null on dismiss), so each pull replays from the top.
  return <RevealBody results={pendingPull} />;
}

function RevealBody({ results }: { results: PullResult[] }) {
  const equipped = useGame((s) => s.state.equipped);
  const dismissPull = useGame((s) => s.dismissPull);
  const [reduced] = useState(prefersReducedMotion);
  const [playing, setPlaying] = useState(true);
  const grid = results.length > 1;

  useEffect(() => {
    if (!playing) return;
    const total = reduced ? REDUCED_MS : CARDS_START_MS + (results.length - 1) * STAGGER_MS + CARD_MS;
    const timers = [setTimeout(() => setPlaying(false), total)];
    // No slam under reduced motion, so no thunk either.
    if (!reduced) timers.push(setTimeout(() => useGame.getState().audio?.play('stamp'), STAMP_HIT_MS));
    // A tap anywhere while it plays jumps to the end state instead of acting on what was hit:
    // capture on document runs before React's own listener, so the Back button is not pressed
    // by the same tap that skipped.
    const skip = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setPlaying(false);
    };
    document.addEventListener('click', skip, true);
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener('click', skip, true);
    };
  }, [playing, reduced, results.length]);

  // reveal-motion drives the full choreography; reveal-fade is the reduced-motion stand-in.
  // Dropping either class is the fast-forward: every element's resting style is its end state.
  const cls = 'reveal' + (playing ? (reduced ? ' reveal-fade' : ' reveal-motion') : '');
  return (
    <Modal open title="Requisition results" className={cls}>
      {playing && !reduced && (
        <div className="reveal-intro" aria-hidden="true">
          <div className="reveal-form">
            <div className="reveal-form-title">Requisition</div>
            <div className="reveal-form-line" />
            <div className="reveal-form-line short" />
            <div className="reveal-form-line" />
            <div className="reveal-stamp">Approved</div>
          </div>
        </div>
      )}
      <div className={grid ? 'reveal-grid' : 'reveal-list'}>
        {results.map((r, i) => (
          <div
            key={i}
            className={(grid ? 'reveal-cell' : 'reveal-row') + glowClass(r)}
            style={{ '--i': i } as CSSProperties}
          >
            <CardTile card={findCard(content, r.cardId)} stars={r.starsAfter} owned equipped={equipped.includes(r.cardId)} shards={r.shards} />
            <span className={'mono' + (grid ? ' reveal-cell-label' : '')}>{resultLabel(r)}</span>
            {r.pityTriggered && <span className="sub brass">Guaranteed</span>}
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={dismissPull}>Back to Personnel</button>
      </div>
    </Modal>
  );
}
