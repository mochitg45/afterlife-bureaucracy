import { useEffect, useState, type CSSProperties } from 'react';
import Decimal from 'break_infinity.js';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { findCard } from '../../engine/content';
import type { EventTier, StaffDef } from '../../engine/content';
import { upcomingEvents, eventRate, eventTap, type EventOccurrence } from '../../engine/events';
import { staffBulkCost, maxAffordable, canAfford } from '../../engine/economy';
import { ODDS, PULL_COST, TEN_PULL_COST } from '../../engine/gacha';
import { formatNumber } from '../../engine/format';
import { fmtCountdown } from '../format';
import { StampSeal } from '../components/StampButton';
import type { BuyMode } from '../../engine/actions';
import { Character } from '../characters/Character';
import { artUrl } from '../characters/art';
import { CardTile, RARITY_LABEL } from '../components/CardTile';
import { VoucherIcon, SealIcon } from '../icons/Currency';
import './EventScreen.css';

const MODES: BuyMode[] = [1, 10, 'max'];
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
  const art = `${import.meta.env.BASE_URL}art/${occ.kind === 'weekly' ? 'depts/limbo' : 'events/' + occ.id}.webp`;
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

function EventStaffRow({ staff, occ, mode }: { staff: StaffDef; occ: EventOccurrence; mode: BuyMode }) {
  const owned = useGame((s) => s.state.event?.staff[staff.id] ?? 0);
  const points = useGame((s) => s.state.event?.points ?? ZERO, (a, b) => a.eq(b));
  const buy = useGame((s) => s.buyEventStaff);
  const count = mode === 'max' ? maxAffordable(staff, owned, points) : mode;
  const cost = staffBulkCost(staff, owned, Math.max(count, 1));
  return (
    <div className="card staff-row">
      <Character id="soul" art={staff.character} mood="ok" size={52} />
      <div className="staff-info">
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

/** The event's stamp, on its own department painting, with the office's floating +N. */
function EventStamp({ occ, tap }: { occ: EventOccurrence; tap: Decimal }) {
  const stamp = useGame((s) => s.eventStamp);
  const [floats, setFloats] = useState<{ id: number; x: number }[]>([]);
  const art = `${import.meta.env.BASE_URL}art/${occ.kind === 'weekly' ? 'depts/limbo' : 'events/' + occ.id}.webp`;
  const onStamp = () => {
    stamp();
    const f = { id: Date.now() + Math.random(), x: 30 + Math.random() * 40 };
    setFloats((cur) => [...cur.slice(-6), f]);
    setTimeout(() => setFloats((cur) => cur.filter((x) => x.id !== f.id)), 700);
  };
  return (
    <div className="stamp-wrap">
      <div className="stamp-scene event-scene" style={{ backgroundImage: `url(${art})` }}>
        <div className="scene-fx scene-ember" aria-hidden="true">
          {[8, 22, 37, 51, 64, 79, 91].map((x, i) => <span key={i} className="fx-dot" style={{ left: `${x}%`, animationDelay: `${i * 1.1}s`, animationDuration: `${7 + (i % 3)}s` }} />)}
        </div>
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

function Banner({ occ }: { occ: EventOccurrence }) {
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
              <div key={c.id} className={'event-card rarity-' + c.rarity + (featured ? ' featured' : '')} data-testid={featured ? 'featured-card' : undefined}>
                {featured && <span className="event-card-tag mono">FEATURED</span>}
                {url ? <img src={url} alt="" /> : <Character id="soul" mood="ok" size={64} />}
                <div className="event-card-name">{c.name}</div>
                <div className="mono sub">{RARITY_LABEL[c.rarity]}{c.id in cards ? ` · ${'★'.repeat(cards[c.id])}` : ''}</div>
              </div>
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
  // The event ended while open: back to the office.
  useEffect(() => { if (!occ) onBack(); }, [occ, onBack]);
  if (!occ || !ev) return null;
  const state = useGame.getState().state;
  const rate = eventRate(state, content, occ);
  const tap = eventTap(state, content, occ);
  const upcoming = upcomingEvents(content, now, 4);
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
      <div className="section-head">
        <h3>Staff</h3>
        <div className="mode-switch" role="group" aria-label="Buy amount">
          {MODES.map((m) => (
            <button key={String(m)} className={'btn btn-ghost' + (mode === m ? ' active' : '')} onClick={() => setMode(m)} aria-label={`×${m}`}>×{m}</button>
          ))}
        </div>
      </div>
      {occ.staff.map((s) => <EventStaffRow key={s.id} staff={s} occ={occ} mode={mode} />)}
      <Track occ={occ} />
      <Banner occ={occ} />
      <div className="section-head"><h3>Upcoming events</h3></div>
      {upcoming.map((o) => (
        <div key={o.key} className="event-upcoming">
          <span>{o.name}</span>
          <span className="mono sub">{o.key === occ.key ? 'Live now' : range(o)}</span>
        </div>
      ))}
    </section>
  );
}
