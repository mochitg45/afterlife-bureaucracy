import { t } from '../../i18n';
import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { findCard } from '../../engine/content';
import { formatNumber } from '../../engine/format';
import type { PullResult } from '../../engine/gacha';
import { CardTile, RARITY_LABEL } from '../components/CardTile';
import { Character } from '../characters/Character';
import type { SfxName } from '../../platform/audio';
import type { CardDef } from '../../engine/content';
import { Modal } from '../components/Modal';
import { KarmaIcon } from '../icons/Currency';
import './PullReveal.css';

/**
 * Reveal timeline (ms). Must stay in step with PullReveal.css: the form slides up and the stamp
 * lands at STAMP_HIT_MS; at CARDS_START_MS every card is on the table face down, and they turn
 * over one at a time. Temp and Full-Time cards flip in place, STEP_MS apart. Senior and
 * Executive cards take the spotlight on their turn (build, flip, hold), then land in the grid.
 */
const STAMP_HIT_MS = 330;
const CARDS_START_MS = 560;
const STEP_MS: Record<Rarity, number> = { temp: 260, fulltime: 380, senior: 0, executive: 0 };
const FLIP_TAIL_MS = 420; // the last in-place flip and its NEW stamp settling
const SPOT_FLIP_MS = 450;
const SPOT_BUILD_MS: Record<Rarity, number> = { temp: 300, fulltime: 450, senior: 800, executive: 1300 };
const SPOT_HOLD_MS: Record<Rarity, number> = { temp: 450, fulltime: 550, senior: 850, executive: 1250 };
const REDUCED_MS = 220;
const hasSpot = (r: Rarity) => r === 'senior' || r === 'executive';
const RARITY_ORDER = ['executive', 'senior', 'fulltime', 'temp'] as const;
type Rarity = CardDef['rarity'];
/** Spark count of the flip burst. */
const BURST: Record<Rarity, number> = { temp: 8, fulltime: 12, senior: 16, executive: 22 };

/** Index of the first result of the rarest rarity in the pull: that card gets the spotlight. */
function bestIndex(results: PullResult[]): number {
  for (const rar of RARITY_ORDER) {
    const i = results.findIndex((r) => r.rarity === rar);
    if (i >= 0) return i;
  }
  return 0;
}

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
        <span className="visually-hidden">{t('pull.kc')}</span>
      </span>
    );
  }
  if (r.spareGained) return t('pull.spare');
  if (r.starsAfter === 1 && r.shards === 0) return <span className="reveal-new">{t('pull.new')}</span>;
  if (r.shards === 0) return t('pull.stars', { n: r.starsAfter });
  return t('pull.shards', { have: r.shards, need: r.shardsNeeded });
}

function glowClass(r: PullResult): string {
  if (r.rarity === 'executive') return ' foil glow glow-exec';
  if (r.rarity === 'senior') return ' glow glow-senior';
  if (r.rarity === 'fulltime') return ' glow glow-fulltime';
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
  // The free daily pull resolves while the rewarded ad still covers the WebView. Hold the
  // choreography until the game is back on screen, or it would finish unseen behind the ad.
  const [onScreen, setOnScreen] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const grid = results.length > 1;
  const bestRarity = results[bestIndex(results)].rarity;
  /** Cards face up so far, and which one (if any) is in the spotlight right now. */
  const [revealed, setRevealed] = useState(0);
  const [spot, setSpot] = useState<number | null>(null);
  const [stung, setStung] = useState(false);
  const sting = (r: Rarity) => {
    setStung(true);
    useGame.getState().audio?.play(('reveal-' + r) as SfxName);
  };
  // Skipped (or reduced motion) before any sting played: the pull's best one, once.
  useEffect(() => {
    if (stung || !onScreen) return;
    if (playing && !reduced) return;
    sting(bestRarity);
  }, [stung, onScreen, playing, reduced, bestRarity]);

  useEffect(() => {
    if (onScreen) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') setOnScreen(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [onScreen]);

  useEffect(() => {
    if (!playing || !onScreen) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    if (reduced) {
      at(REDUCED_MS, () => setPlaying(false));
    } else {
      at(STAMP_HIT_MS, () => useGame.getState().audio?.play('stamp'));
      let time = CARDS_START_MS;
      let spotted = false;
      results.forEach((r, i) => {
        if (hasSpot(r.rarity)) {
          spotted = true;
          const flipAt = time + SPOT_BUILD_MS[r.rarity];
          at(time, () => setSpot(i));
          at(flipAt + SPOT_FLIP_MS * 0.4, () => sting(r.rarity));
          time = flipAt + SPOT_FLIP_MS + SPOT_HOLD_MS[r.rarity];
          at(time, () => { setSpot(null); setRevealed(i + 1); });
        } else {
          at(time, () => setRevealed(i + 1));
          time += STEP_MS[r.rarity];
        }
      });
      // No spotlight in this pull: the best card's sting rings as the last card turns.
      if (!spotted) at(time - STEP_MS[results[results.length - 1].rarity], () => sting(bestRarity));
      at(time + FLIP_TAIL_MS, () => setPlaying(false));
    }
    // A tap anywhere while it plays turns every card at once instead of acting on what was hit:
    // capture on document runs before React's own listener, so Done is not pressed by the same
    // tap that skipped.
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
    // sting is stable in effect: it only sets state and plays a sound.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, onScreen, reduced, results, bestRarity]);

  const animating = playing && onScreen && !reduced;
  const cls = 'reveal' + (playing ? (!onScreen ? ' reveal-waiting' : reduced ? ' reveal-fade' : ' reveal-motion') : '');
  return (
    <Modal open title={t('pull.title')} className={cls}>
      {animating && (
        <div className="reveal-intro" aria-hidden="true">
          <div className="reveal-form">
            <div className="reveal-form-title">{t('pull.form')}</div>
            <div className="reveal-form-line" />
            <div className="reveal-form-line short" />
            <div className="reveal-form-line" />
            <div className="reveal-stamp">{t('pull.stamp')}</div>
          </div>
        </div>
      )}
      {animating && spot !== null && createPortal(
        <Spotlight key={spot} card={findCard(content, results[spot].cardId)} />,
        document.body,
      )}
      <div className={grid ? 'reveal-grid' : 'reveal-list'}>
        {results.map((r, i) => {
          const faceUp = !animating || i < revealed;
          return (
            <div
              key={i}
              className={(grid ? 'reveal-cell' : 'reveal-row') + (faceUp ? glowClass(r) + (animating ? ' flip-in' : '') : ' face-down')}
              style={{ '--i': i } as CSSProperties}
            >
              <CardTile card={findCard(content, r.cardId)} stars={r.starsAfter} owned equipped={equipped.includes(r.cardId)} shards={r.shards} size={grid ? 40 : 48} />
              <span className={'mono' + (grid ? ' reveal-cell-label' : '')}>{resultLabel(r)}</span>
              {r.pityTriggered && <span className="sub brass">{t('pull.guaranteed')}</span>}
            </div>
          );
        })}
      </div>
      <div className="modal-actions">
        {/* While cards are turning, the button skips (via the document listener); after, it closes. */}
        <button className="btn btn-primary" onClick={playing ? undefined : dismissPull}>{t(playing ? 'pull.skip' : 'pull.done')}</button>
      </div>
    </Modal>
  );
}

/**
 * The best card's moment, after the promo's Executive reveal: a card back shakes while rays
 * build, leans back, flips with an overshoot into a flash and a spark burst, then a shine
 * sweeps the face and the rarity banner slams down. Colour and intensity come from the rarity
 * (see the .spot-<rarity> tokens in PullReveal.css). Purely decorative: the results grid
 * underneath carries the accessible content.
 */
function Spotlight({ card }: { card: CardDef }) {
  const r = card.rarity;
  const style = {
    '--spot-start': '0ms',
    '--build': `${SPOT_BUILD_MS[r]}ms`,
    '--flip': `${SPOT_FLIP_MS}ms`,
    '--hold': `${SPOT_HOLD_MS[r]}ms`,
  } as CSSProperties;
  const n = BURST[r];
  return (
    <div className={`spot spot-${r}`} style={style} aria-hidden="true">
      <div className="spot-rays" />
      <div className="spot-stage">
        <div className="spot-shake">
          <div className="spot-card">
            <div className="spot-face spot-back"><span>A·B</span></div>
            <div className={`spot-face spot-front rarity-${r}`}>
              <Character id={card.character} art={card.id} mood="ok" size={120} />
              <span className="spot-name">{card.name}</span>
              <span className="spot-title sub">{card.title}</span>
              <span className="spot-shine" />
            </div>
          </div>
        </div>
        <div className="spot-burst">
          {Array.from({ length: n }).map((_, i) => (
            <i key={i} style={{ '--a': `${(360 / n) * i + (i % 2) * 9}deg`, '--d': `${110 + (i % 3) * 40}px` } as CSSProperties} />
          ))}
        </div>
        <div className="spot-banner">{RARITY_LABEL[r]}</div>
      </div>
      <div className="spot-flash" />
    </div>
  );
}
