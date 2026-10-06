import { useEffect, useState, type CSSProperties } from 'react';
import Decimal from 'break_infinity.js';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { findCard } from '../../engine/content';
import type { EventTier, StaffDef } from '../../engine/content';
import { upcomingEvents, eventRate, eventTap, type EventOccurrence } from '../../engine/events';
import { staffBulkCost, maxAffordable, canAfford } from '../../engine/economy';
import { ODDS, PULL_COST, TEN_PULL_COST, MAX_STARS } from '../../engine/gacha';
import { formatNumber } from '../../engine/format';
import { fmtCountdown } from '../format';
import { StampSeal } from '../components/StampButton';
import type { BuyMode } from '../../engine/actions';
import { Character } from '../characters/Character';
import { artUrl } from '../characters/art';
import { CardTile, RARITY_LABEL } from '../components/CardTile';
import { VoucherIcon, SealIcon } from '../icons/Currency';
import { Modal } from '../components/Modal';
import { CardSheet, bonusLine } from '../overlays/CardSheet';
import './EventScreen.css';

const MODES: BuyMode[] = [1, 10, 'max'];
type EventTab = 'staff' | 'rewards' | 'gacha';
type Info = { kind: 'staff'; staff: StaffDef } | { kind: 'card'; id: string };
const RARITIES = ['temp', 'fulltime', 'senior', 'executive'] as const;
const ZERO = new Decimal(0);

/** Ticks once a minute: the countdowns only show whole minutes. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** The running occurrence, re-read whenever the event state changes (activeEvent() itself is not reactive). */
function useActiveEvent(): EventOccurrence | null {
  useGame((s) => s.state.event?.key);
  return useGame.getState().activeEvent();
}

const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const range = (o: EventOccurrence) => `${dayFmt.format(o.startWall)} – ${dayFmt.format(o.endWall - 1)}`;
const tagOf = (o: EventOccurrence) => (o.kind === 'weekly' ? 'WEEKLY EVENT' : 'SPECIAL EVENT');

/** Office entry point: shown only while an event is running. */
export function EventBanner({ onOpen }: { onOpen: () => void }) {
  const occ = useActiveEvent();
  const now = useNow();
  const [imgOk, setImgOk] = useState(true);
  if (!occ) return null;
  const art = `${import.meta.env.BASE_URL}art/${occ.kind === 'weekly' ? 'events/weekly-' + occ.id : 'events/' + occ.id}.webp`;
  return (
    <div className="card event-banner" style={{ borderColor: occ.accent }}>
      {imgOk && <img className="event-art" src={art} alt="" onError={() => setImgOk(false)} />}
      <span className="event-tag mono" style={{ color: occ.accent }}>{tagOf(occ)}</span>
      <h3>{occ.name}</h3>
      <div className="sub">{occ.blurb}</div>
      <div className="mono sub">Ends in {fmtCountdown(occ.endWall - now)}</div>
      <button className="btn btn-primary" style={{ background: occ.accent, borderColor: occ.accent }} onClick={onOpen}>Open {occ.deptName}</button>
    </div>
  );
}

function EventStaffRow({ staff, occ, mode, onInfo }: { staff: StaffDef; occ: EventOccurrence; mode: BuyMode; onInfo: () => void }) {
  const owned = useGame((s) => s.state.event?.staff[staff.id] ?? 0);
  const points = useGame((s) => s.state.event?.points ?? ZERO, (a, b) => a.eq(b));
  const buy = useGame((s) => s.buyEventStaff);
  const count = mode === 'max' ? maxAffordable(staff, owned, points) : mode;
  const cost = staffBulkCost(staff, owned, Math.max(count, 1));
  return (
    <div className="card staff-row">
      <button className="event-info-btn" onClick={onInfo} aria-label={`About ${staff.name}`}>
        <Character id="soul" art={staff.character} mood="ok" size={52} />
      </button>
      <div className="staff-info" onClick={onInfo}>
        <div className="staff-name">{staff.name} <span className="mono owned">×{owned}</span></div>
        <div className="sub">{staff.role} — {staff.flavor}</div>
        <div className="mono sub">{owned ? `+${formatNumber(new Decimal(staff.baseRate * owned))}/s` : 'Hire to start filing'}</div>
      </div>
      <button className="btn hire" disabled={count <= 0 || !canAfford(cost, points)} onClick={() => buy(staff.id, mode)} aria-label={`Hire ${staff.name}`}>
        <span>Hire {mode === 'max' ? (count || 1) : mode}</span>
        <span className="mono amt">{formatNumber(cost)}</span>
      </button>
    </div>
  );
}

/**
 * Each event's ambient particles: a glyph (or a plain dot) and which way it travels. Fall and
 * rise loop from off-scene edge to edge; drift crosses sideways. Unknown ids fall back to embers.
 */
const FX: Record<string, { glyph?: string; dir: 'fall' | 'rise' | 'drift'; color: string }> = {
  halloween: { glyph: '🦇', dir: 'drift', color: '#2a1f3d' },
  christmas: { glyph: '❄', dir: 'fall', color: '#ffffff' },
  newyear: { glyph: '✦', dir: 'fall', color: '#ffd166' },
  valentine: { glyph: '♥', dir: 'rise', color: '#ff7aa2' },
  easter: { glyph: '✿', dir: 'fall', color: '#ffc0d9' },
  summer: { dir: 'rise', color: 'rgb(255 255 255 / 0.85)' },
  'great-backlog': { glyph: '▭', dir: 'fall', color: '#fffaf0' },
  'tax-season': { glyph: '$', dir: 'fall', color: '#8fd18f' },
  retrograde: { glyph: '✧', dir: 'rise', color: '#c9b8ff' },
  'lost-socks': { dir: 'drift', color: '#d9d4cc' },
  'printer-exorcism': { glyph: '▭', dir: 'drift', color: '#c8ffd8' },
  'casual-friday': { dir: 'rise', color: 'rgb(255 255 255 / 0.85)' },
  'valhalla-feast': { dir: 'rise', color: '#ffb347' },
  'sin-pride': { glyph: '✦', dir: 'rise', color: '#ffe08a' },
  'sin-greed': { glyph: '●', dir: 'fall', color: '#ffcf40' },
  'sin-wrath': { dir: 'rise', color: '#ff6a3d' },
  'sin-envy': { glyph: '❦', dir: 'fall', color: '#7bd67b' },
  'sin-gluttony': { glyph: '•', dir: 'fall', color: '#e8b27a' },
  'sin-sloth': { glyph: 'z', dir: 'rise', color: '#d8d0ff' },
  'sin-lust': { glyph: '♥', dir: 'rise', color: '#ff8fb3' },
};
const FX_SLOTS = [6, 17, 29, 41, 52, 63, 74, 86, 95] as const;

function EventFx({ id }: { id: string }) {
  const fx = FX[id] ?? { dir: 'rise', color: '#ffb347' };
  return (
    <div className={`scene-fx event-fx fx-${fx.dir}`} aria-hidden="true" data-testid="event-fx">
      {FX_SLOTS.map((x, i) => (
        <span
          key={i}
          className={fx.glyph ? 'fx-glyph' : 'fx-dot event-dot'}
          style={{ left: `${x}%`, top: fx.dir === 'drift' ? `${12 + ((i * 37) % 70)}%` : undefined, color: fx.color, background: fx.glyph ? undefined : fx.color, animationDelay: `${(i * 1.3) % 9}s`, animationDuration: `${7 + (i % 4) * 1.5}s`, fontSize: `${12 + (i % 3) * 5}px` }}
        >{fx.glyph}</span>
      ))}
    </div>
  );
}

/** The event's stamp, on its own department painting, with the office's floating +N. */
function EventStamp({ occ, tap }: { occ: EventOccurrence; tap: Decimal }) {
  const stamp = useGame((s) => s.eventStamp);
  const [floats, setFloats] = useState<{ id: number; x: number }[]>([]);
  const art = `${import.meta.env.BASE_URL}art/${occ.kind === 'weekly' ? 'events/weekly-' + occ.id : 'events/' + occ.id}.webp`;
  const onStamp = () => {
    stamp();
    const f = { id: Date.now() + Math.random(), x: 30 + Math.random() * 40 };
    setFloats((cur) => [...cur.slice(-6), f]);
    setTimeout(() => setFloats((cur) => cur.filter((x) => x.id !== f.id)), 700);
  };
  return (
    <div className="stamp-wrap">
      <div className="stamp-scene event-scene" style={{ backgroundImage: `url(${art})` }}>
        <EventFx id={occ.id} />
        {floats.map((f) => <span key={f.id} className="float mono" style={{ left: f.x + '%' }}>+{formatNumber(tap)}</span>)}
        <button className="stamp" onPointerDown={onStamp} onClick={(e) => { if (e.detail === 0) onStamp(); }} aria-label="Stamp event soul">
          <StampSeal />
        </button>
        <div className="mono sub stamp-scene-pill">+{formatNumber(tap)} {occ.currency} per stamp</div>
      </div>
    </div>
  );
}

function RewardLabel({ tier }: { tier: EventTier }) {
  const r = tier.reward;
  if (r.type === 'vouchers') return <span className="event-reward amt">{r.amount} <VoucherIcon /> Vouchers</span>;
  if (r.type === 'seals') return <span className="event-reward amt">{r.amount} <SealIcon /> Seals</span>;
  const card = findCard(content, r.card);
  return <span className="event-reward"><Character id="soul" art={card.id} mood="ok" size={28} /> {card.name}</span>;
}

function Track({ occ }: { occ: EventOccurrence }) {
  const earned = useGame((s) => s.state.event?.earned ?? ZERO, (a, b) => a.eq(b));
  const claimed = useGame((s) => s.state.event?.claimed);
  const claim = useGame((s) => s.claimEventTier);
  return (
    <>
      <div className="section-head"><h3>Reward track</h3></div>
      {occ.track.map((tier, i) => {
        const done = claimed?.includes(i) ?? false;
        const reached = earned.gte(tier.at);
        const pct = Math.min(100, earned.div(tier.at).toNumber() * 100);
        return (
          <div key={i} className={'card event-tier' + (done ? ' claimed' : '')} data-testid={`tier-${i}`}>
            <div>
              <RewardLabel tier={tier} />
              <div className="mono sub">{formatNumber(reached ? new Decimal(tier.at) : earned)} / {formatNumber(new Decimal(tier.at))}</div>
            </div>
            {done ? <span className="mono sub">CLAIMED</span>
              : reached ? <button className="btn btn-primary" onClick={() => claim(i)} aria-label={`Claim tier ${i + 1}`}>Claim</button>
              : <span className="mono sub">Locked</span>}
            <div className="bar"><div className="bar-fill" style={{ width: pct + '%' }} /></div>
          </div>
        );
      })}
    </>
  );
}

/** Tapped staff: what one hire files, what the whole team files, and the next price. */
function StaffInfo({ staff, occ, onClose }: { staff: StaffDef; occ: EventOccurrence; onClose: () => void }) {
  const owned = useGame((s) => s.state.event?.staff[staff.id] ?? 0);
  const state = useGame((s) => s.state);
  const each = new Decimal(staff.baseRate);
  const team = each.mul(owned);
  const total = eventRate(state, content, occ);
  const share = total.gt(0) ? Math.round(team.div(total).toNumber() * 100) : 0;
  const url = artUrl(staff.character);
  return (
    <Modal open title={staff.name} label={`${staff.name}, ${staff.role}`} onClose={onClose}>
      <div className="card-sheet-head">
        {url ? <img className="event-info-art" src={url} alt="" /> : <Character id="soul" mood="ok" size={96} />}
        <span className="sub">{staff.role}</span>
        <span className="mono sub">Hired ×{owned}</span>
      </div>
      <p>{staff.flavor}</p>
      <div className="event-info-stats mono">
        <span>Each hire</span><span>+{formatNumber(each)} {occ.currency}/s</span>
        <span>This team</span><span>+{formatNumber(team)}/s{owned ? ` (${share}% of event)` : ''}</span>
        <span>Next hire</span><span>{formatNumber(staffBulkCost(staff, owned, 1))} {occ.currency}</span>
      </div>
      <p className="sub">Event staff leave when {occ.name} ends. Cards from the banner stay forever.</p>
    </Modal>
  );
}

/** Tapped banner card the player does not own yet: its skill at ★1 and at max, and its odds. */
function CardPreview({ id, onClose }: { id: string; onClose: () => void }) {
  const card = findCard(content, id);
  const url = artUrl(card.character);
  return (
    <Modal open title={card.name} label={`${card.name}, ${card.title}`} onClose={onClose}>
      <div className="card-sheet-head">
        {url ? <img className="event-info-art" src={url} alt="" /> : <Character id="soul" mood="ok" size={96} />}
        <span className="sub">{card.title}</span>
        <span className="sub">{RARITY_LABEL[card.rarity]} · {Math.round(ODDS[card.rarity] * 1000) / 10}% per pull</span>
      </div>
      <p>{card.flavor}</p>
      <div className="event-info-stats mono">
        <span>Skill ★1</span><span>{bonusLine(card, 1)}</span>
        <span>Skill ★{MAX_STARS}</span><span>{bonusLine(card, MAX_STARS)}</span>
      </div>
      <p className="sub">{card.effect.type === 'eventMult' ? 'Works in every future event while equipped.' : 'Works all year while equipped.'} Not owned yet.</p>
    </Modal>
  );
}

function Banner({ occ, onInfo }: { occ: EventOccurrence; onInfo: (id: string) => void }) {
  const vouchers = useGame((s) => s.state.vouchers);
  const cards = useGame((s) => s.state.cards);
  const pullEvent = useGame((s) => s.pullEvent);
  const banner = occ.banner;
  if (!banner) return null;
  const mine = content.cards.filter((c) => c.event === occ.id);
  return (
    <>
      <div className="section-head"><h3>{banner.name}</h3></div>
      <div className="card">
        {/* A banner shows what can be won, so the art is always revealed (the collection hides unowned cards). */}
        <div className="event-cards">
          {mine.map((c) => {
            const url = artUrl(c.character);
            const featured = c.id === banner.featured;
            return (
              <button key={c.id} className={'event-card rarity-' + c.rarity + (featured ? ' featured' : '')} data-testid={featured ? 'featured-card' : undefined} onClick={() => onInfo(c.id)} aria-label={`About ${c.name}`}>
                {featured && <span className="event-card-tag mono">FEATURED</span>}
                {url ? <img src={url} alt="" /> : <Character id="soul" mood="ok" size={64} />}
                <div className="event-card-name">{c.name}</div>
                <div className="mono sub">{RARITY_LABEL[c.rarity]}{c.id in cards ? ` · ${'★'.repeat(cards[c.id])}` : ''}</div>
                <div className="event-card-skill">{bonusLine(c, 1)}</div>
              </button>
            );
          })}
        </div>
        <div className="modal-actions">
          <button className="btn" disabled={vouchers < PULL_COST} onClick={() => pullEvent(1)} aria-label={`Pull one event card, ${PULL_COST} vouchers`}>
            Pull ×1 <span className="amt">{PULL_COST} <VoucherIcon /></span>
          </button>
          <button className="btn btn-primary" disabled={vouchers < TEN_PULL_COST} onClick={() => pullEvent(10)} aria-label={`Pull ten event cards, ${TEN_PULL_COST} vouchers`}>
            Pull ×10 <span className="amt">{TEN_PULL_COST} <VoucherIcon /></span>
          </button>
        </div>
        <p className="sub">Event cards stay in your collection forever.</p>
        <p className="sub mono">{RARITIES.map((r) => `${RARITY_LABEL[r]} ${Math.round(ODDS[r] * 1000) / 10}%`).join(' · ')}</p>
      </div>
    </>
  );
}

export function EventScreen({ onBack }: { onBack: () => void }) {
  const occ = useActiveEvent();
  const now = useNow();
  const ev = useGame((s) => s.state.event);
  const [mode, setMode] = useState<BuyMode>(1);
  const [tab, setTab] = useState<EventTab>('staff');
  const [info, setInfo] = useState<Info | null>(null);
  const ownedCards = useGame((s) => s.state.cards);
  const leaderboard = useGame((s) => s.leaderboardAvailable);
  const openBoard = useGame((s) => s.openEventLeaderboard);
  // The event ended while open: back to the office.
  useEffect(() => { if (!occ) onBack(); }, [occ, onBack]);
  // Each event has its own music while its screen is open; leaving restores the office loop.
  const themeId = occ?.id ?? null;
  useEffect(() => {
    if (!themeId) return;
    const { audio } = useGame.getState();
    audio?.setMusicTheme(themeId);
    return () => audio?.setMusicTheme(null);
  }, [themeId]);
  if (!occ || !ev) return null;
  const state = useGame.getState().state;
  const rate = eventRate(state, content, occ);
  const tap = eventTap(state, content, occ);
  const upcoming = upcomingEvents(content, now, 4);
  const ready = occ.track.filter((t, i) => ev.earned.gte(t.at) && !ev.claimed.includes(i)).length;
  const tabs: [EventTab, string][] = [['staff', 'Staff'], ['rewards', 'Rewards'], ...(occ.banner ? [['gacha', 'Gacha'] as [EventTab, string]] : [])];
  return (
    <section className="screen event-screen" style={{ '--accent': occ.accent } as CSSProperties}>
      <header className="screen-header">
        <button className="btn btn-ghost" onClick={onBack} aria-label="Back to office">← Office</button>
        <h2>{occ.deptName}</h2>
      </header>
      <div className="card">
        <div className="label">{occ.name} · Ends in {fmtCountdown(occ.endWall - now)}</div>
        <div className="event-stats">
          <span className="mono value amt">{formatNumber(ev.points)} {occ.currency}</span>
          <span className="mono sub">+{formatNumber(rate)}/s</span>
        </div>
        <div className="mono sub">Earned {formatNumber(ev.earned)}</div>
      </div>
      <EventStamp occ={occ} tap={tap} />
      <div className="event-tabs" role="tablist" aria-label="Event sections">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={'event-tab' + (tab === id ? ' active' : '')} onClick={() => setTab(id)}>
            {label}{id === 'rewards' && ready > 0 && <span className="event-tab-badge mono">{ready}</span>}
          </button>
        ))}
      </div>
      {tab === 'staff' && (
        <>
          <div className="section-head">
            <h3>Staff</h3>
            <div className="mode-switch" role="group" aria-label="Buy amount">
              {MODES.map((m) => (
                <button key={String(m)} className={'btn btn-ghost' + (mode === m ? ' active' : '')} onClick={() => setMode(m)} aria-label={`×${m}`}>×{m}</button>
              ))}
            </div>
          </div>
          {occ.staff.map((s) => <EventStaffRow key={s.id} staff={s} occ={occ} mode={mode} onInfo={() => setInfo({ kind: 'staff', staff: s })} />)}
        </>
      )}
      {tab === 'rewards' && (
        <>
          {leaderboard && <button className="btn event-board" onClick={() => void openBoard()}>🏆 {occ.name} leaderboard</button>}
          <Track occ={occ} />
          <div className="section-head"><h3>Upcoming events</h3></div>
          {upcoming.map((o) => (
            <div key={o.key} className="event-upcoming">
              <span>{o.name}</span>
              <span className="mono sub">{o.key === occ.key ? 'Live now' : range(o)}</span>
            </div>
          ))}
        </>
      )}
      {tab === 'gacha' && <Banner occ={occ} onInfo={(id) => setInfo({ kind: 'card', id })} />}
      {info?.kind === 'staff' && <StaffInfo staff={info.staff} occ={occ} onClose={() => setInfo(null)} />}
      {info?.kind === 'card' && (info.id in ownedCards
        ? <CardSheet cardId={info.id} onClose={() => setInfo(null)} />
        : <CardPreview id={info.id} onClose={() => setInfo(null)} />)}
    </section>
  );
}
