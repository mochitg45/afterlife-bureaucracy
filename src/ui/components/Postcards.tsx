import { useEffect, useState } from 'react';
import { useGame } from '../../store/game';
import { postcards } from '../../data';
import { ALBUM_MILESTONES, POSTCARD_IDS, postcardSouls, postcardsOpen } from '../../engine/postcards';
import { formatNumber } from '../../engine/format';
import { Modal } from './Modal';
import { t } from '../../i18n';
import './Postcards.css';

const byId = new Map(postcards.map((p) => [p.id, p]));

/** Hand-drawn-looking envelope; an icon, so no emoji. */
function Envelope({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <rect x="2" y="2" width="28" height="20" rx="2" />
      <path d="M3 4 L16 14 L29 4" />
    </svg>
  );
}

/** The CSS postcard: stamp corner, postmark ring, typewriter text and (sometimes) a portrait. */
export function PostcardView({ id }: { id: string }) {
  const p = byId.get(id);
  if (!p) return null;
  return (
    <article className={`postcard pc-${p.rarity}`} data-rarity={p.rarity}>
      <div className="pc-stamp" aria-hidden="true">
        {p.art ? <img src={`art/chars/${p.art}.webp`} alt="" /> : <span className="pc-motif" />}
      </div>
      <svg className="pc-postmark" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="32" cy="32" r="21" fill="none" stroke="currentColor" strokeWidth="1" />
        <text x="32" y="36" textAnchor="middle" fontSize="9" fill="currentColor" letterSpacing="1">{t('postcard.postmark')}</text>
      </svg>
      <p className="pc-from">{t('postcard.from', { name: p.name })}</p>
      <p className="pc-life">{p.title}</p>
      <p className="pc-msg">{p.text}</p>
      <span className="pc-rarity">{t(`postcard.rarity.${p.rarity}`)}</span>
    </article>
  );
}

/** Flips from the envelope back to the message; with reduced motion the CSS skips the turn. */
function Flip({ id }: { id: string }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setFlipped(true));
    return () => cancelAnimationFrame(raf);
  }, [id]);
  return (
    <div className={'pc-flip' + (flipped ? ' flipped' : '')}>
      <div className="pc-flip-inner">
        <div className="pc-flip-front"><Envelope size={64} /></div>
        <div className="pc-flip-back"><PostcardView id={id} /></div>
      </div>
    </div>
  );
}

function Album({ onClose }: { onClose: () => void }) {
  const collected = useGame((s) => s.state.postcards.collected);
  const waiting = useGame((s) => s.state.postcards.waiting.length);
  const open = useGame((s) => s.openPostcard);
  const [shown, setShown] = useState<string | null>(null);
  const [gift, setGift] = useState<{ souls: string; vouchers: number } | null>(null);
  const total = POSTCARD_IDS.length;
  const next = ALBUM_MILESTONES.find((m) => collected.length < m.at);

  const onOpen = () => {
    const g = useGame.getState();
    const souls = formatNumber(postcardSouls(g.rates.soulsPerSec, g.state.soulsLifetime));
    const before = g.state.postcards.collected.length;
    const id = open();
    if (!id) return;
    const after = useGame.getState().state.postcards.collected.length;
    const vouchers = ALBUM_MILESTONES.filter((m) => before < m.at && after >= m.at).reduce((a, m) => a + m.vouchers, 0);
    setShown(id);
    setGift({ souls, vouchers });
  };

  return (
    <Modal open title={t('postcard.title')} className="pc-album" onClose={onClose}>
      <p className="sub mono pc-progress">{t('postcard.progress', { have: collected.length, total })}{next ? ' · ' + t('postcard.nextReward', { n: next.at, v: next.vouchers }) : ''}</p>
      {shown && <Flip key={shown} id={shown} />}
      {gift && (
        <p className="pc-gift" role="status">
          {t('postcard.gift', { souls: gift.souls })}{gift.vouchers > 0 ? ' ' + t('postcard.milestone', { v: gift.vouchers }) : ''}
        </p>
      )}
      <button type="button" className="btn btn-primary" disabled={waiting === 0} onClick={onOpen}>
        {waiting > 0 ? t('postcard.open', { n: waiting }) : t('postcard.none')}
      </button>
      <div className="pc-grid">
        {POSTCARD_IDS.map((id) => {
          const p = byId.get(id);
          const has = collected.includes(id);
          return has && p ? (
            <button key={id} type="button" className={`pc-cell pc-${p.rarity}`} onClick={() => setShown(id)} aria-label={t('postcard.view', { name: p.name })}>
              <span className="pc-cell-name">{p.name}</span>
            </button>
          ) : (
            <div key={id} className="pc-cell pc-locked" aria-label={t('postcard.hidden')}>
              <Envelope size={20} />
            </div>
          );
        })}
      </div>
      <button type="button" className="btn btn-ghost" onClick={onClose}>{t('postcard.close')}</button>
    </Modal>
  );
}

/**
 * The small mailbox row on the Office screen. Shown once the Reincarnation Desk has opened; the
 * badge counts postcards waiting. Tapping opens the Album (never a pop-up on its own).
 */
export function MailboxEntry() {
  const visible = useGame((s) => postcardsOpen(s.state));
  const waiting = useGame((s) => s.state.postcards.waiting.length);
  const have = useGame((s) => s.state.postcards.collected.length);
  const [open, setOpen] = useState(false);
  if (!visible) return null;
  return (
    <>
      <button type="button" className="pc-mailbox" onClick={() => setOpen(true)} aria-label={waiting > 0 ? t('postcard.mailboxWaiting', { n: waiting }) : t('postcard.mailbox')}>
        <Envelope />
        <span className="pc-mailbox-label">{t('postcard.mailbox')}</span>
        <span className="sub mono">{have}/{POSTCARD_IDS.length}</span>
        {waiting > 0 && <span className="pc-badge" aria-hidden="true">{waiting}</span>}
      </button>
      {open && <Album onClose={() => setOpen(false)} />}
    </>
  );
}
