import { useCallback, useEffect, useRef, useState } from 'react';
import type Decimal from 'break_infinity.js';
import { t } from '../../i18n';
import { useGame, TRAINING_DONE } from '../../store/game';
import { RUSH_SECONDS, RUSH_ROUNDS, comboMult, rushAvailable } from '../../engine/rush';
import { formatNumber } from '../../engine/format';
import { fmtLeft } from '../format';
import { track } from '../../platform/analytics';
import * as haptics from '../../platform/haptics';
import './StampRush.css';

type Kind = 'normal' | 'flag' | 'special';
interface Doc { id: number; kind: Kind; born: number; ttl: number }
interface Msg { id: number; text: string; bad?: boolean }

const MAX_DOCS = 4;
const HOLD_MS = 400;
const SWIPE_PX = 50;
const NEAR_MISS = 0.8; // acting in the last 20% of a form's life is a near miss
const BASE: Record<Kind, number> = { normal: 1, flag: 2, special: 3 };
const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.min(1, Math.max(0, k));

/** Which form comes next: the first few are easy taps, then red and gold forms join in. */
function pickKind(n: number, sec: number): Kind {
  if (n < 3) return 'normal';
  const r = Math.random();
  if (sec > 10 && r > 0.8) return 'special';
  if (sec > 4 && r > 0.5) return 'flag';
  return 'normal';
}

/** The office card: opens the round, or says when the break ends. */
export function StampRushEntry() {
  const trained = useGame((s) => s.state.onboarding.trainingStep >= TRAINING_DONE);
  const rush = useGame((s) => s.state.rush);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const ready = rushAvailable(rush, now);
  useEffect(() => {
    if (ready) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ready]);
  useEffect(() => { if (!open) setNow(Date.now()); }, [open]);
  if (!trained) return null;
  return (
    <>
      <div className="card rush-entry">
        <div>
          <strong>{t('rush.title')}</strong>
          <div className="sub">{ready ? t('rush.sub') : t('rush.cooldown', { time: fmtLeft(rush.cooldownUntil - now) })}</div>
        </div>
        <button className="btn btn-primary" disabled={!ready} onClick={() => setOpen(true)}>{t('rush.open')}</button>
      </div>
      {open && <StampRush onClose={() => setOpen(false)} />}
    </>
  );
}

type View = { docs: (Doc & { hold: number; left: number })[]; combo: number; points: number; secLeft: number; msg: Msg | null; shake: number };

export function StampRush({ onClose }: { onClose: () => void }) {
  const startRush = useGame((s) => s.startRush);
  const finishRush = useGame((s) => s.finishRush);
  const rush = useGame((s) => s.state.rush);
  const [phase, setPhase] = useState<'intro' | 'play' | 'done'>('intro');
  const [view, setView] = useState<View>({ docs: [], combo: 0, points: 0, secLeft: RUSH_SECONDS, msg: null, shake: 0 });
  const [reward, setReward] = useState<{ souls: Decimal; kc: Decimal; best: number; points: number } | null>(null);
  const g = useRef({ docs: [] as Doc[], points: 0, combo: 0, best: 0, nextId: 1, spawned: 0, nextSpawn: 0, start: 0, msg: null as Msg | null, shake: 0, ended: false });
  const press = useRef<{ id: number; x: number; t: number; done: boolean } | null>(null);

  const say = (text: string, bad = false) => { g.current.msg = { id: g.current.nextId++, text, bad }; };
  const wrong = () => {
    const s = g.current;
    s.combo = 0; s.shake++;
    say(t('rush.wrong'), true);
    haptics.heavy();
  };
  const act = (doc: Doc, now: number) => {
    const s = g.current;
    const late = (now - doc.born) / doc.ttl >= NEAR_MISS;
    s.points += BASE[doc.kind] * comboMult(s.combo) + (late ? 1 : 0);
    s.combo++; s.best = Math.max(s.best, s.combo);
    s.docs = s.docs.filter((d) => d.id !== doc.id);
    say(late ? t('rush.nearMiss') : t(doc.kind === 'normal' ? 'rush.approved' : doc.kind === 'flag' ? 'rush.rejected' : 'rush.filed'));
    if (doc.kind === 'normal') haptics.tap(); else haptics.heavy();
  };

  const end = useCallback(() => {
    const s = g.current;
    if (s.ended) return;
    s.ended = true;
    const points = Math.round(s.points);
    const pay = finishRush(points);
    track('rush_end', { score: points, combo: s.best });
    setReward({ ...pay, best: s.best, points });
    setPhase('done');
  }, [finishRush]);

  const begin = () => {
    if (!startRush()) { onClose(); return; }
    const now = performance.now();
    g.current = { docs: [], points: 0, combo: 0, best: 0, nextId: 1, spawned: 0, nextSpawn: now, start: now, msg: null, shake: 0, ended: false };
    press.current = null;
    track('rush_start');
    setPhase('play');
  };

  useEffect(() => {
    if (phase !== 'play') return;
    const timer = setInterval(() => {
      const s = g.current;
      const now = performance.now();
      const sec = (now - s.start) / 1000;
      if (sec >= RUSH_SECONDS) { end(); return; }
      const k = sec / RUSH_SECONDS; // the pace ramps up with the round
      // a held red form is rejected once the press has lasted long enough
      const p = press.current;
      const held = p && !p.done ? s.docs.find((d) => d.id === p.id && d.kind === 'flag') : undefined;
      if (p && held && now - p.t >= HOLD_MS) { p.done = true; act(held, now); }
      // forms that sat too long break the combo
      const expired = s.docs.filter((d) => now - d.born >= d.ttl);
      if (expired.length) {
        s.docs = s.docs.filter((d) => !expired.includes(d));
        s.combo = 0; s.shake++;
        say(t('rush.missed'), true);
        haptics.heavy();
      }
      if ((now >= s.nextSpawn && s.docs.length < MAX_DOCS) || s.docs.length === 0) {
        s.docs.push({ id: s.nextId++, kind: pickKind(s.spawned++, sec), born: now, ttl: lerp(3800, 1800, k) });
        s.nextSpawn = now + lerp(950, 420, k);
      }
      const hp = press.current;
      setView({
        docs: s.docs.map((d) => ({ ...d, hold: hp && hp.id === d.id && d.kind === 'flag' ? Math.min(1, (now - hp.t) / HOLD_MS) : 0, left: 1 - (now - d.born) / d.ttl })),
        combo: s.combo, points: Math.round(s.points), secLeft: Math.ceil(RUSH_SECONDS - sec), msg: s.msg, shake: s.shake,
      });
    }, 50);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- act/say only touch refs
  }, [phase, end]);

  const onDown = (e: React.PointerEvent, d: Doc) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    press.current = { id: d.id, x: e.clientX, t: performance.now(), done: false };
  };
  const onMove = (e: React.PointerEvent, d: Doc) => {
    const p = press.current;
    if (!p || p.id !== d.id || p.done || d.kind !== 'special') return;
    if (Math.abs(e.clientX - p.x) >= SWIPE_PX) { p.done = true; act(d, performance.now()); }
  };
  const onUp = (e: React.PointerEvent, d: Doc) => {
    const p = press.current;
    press.current = null;
    if (!p || p.id !== d.id || p.done || !g.current.docs.some((x) => x.id === d.id)) return;
    if (d.kind === 'normal' && Math.abs(e.clientX - p.x) < 20) act(d, performance.now());
    else wrong(); // a swiped normal form, a tapped gold form, a red form let go too soon
  };

  const mult = comboMult(view.combo);
  const cooling = !rushAvailable(rush, Date.now());
  const roundsLeft = cooling ? 0 : RUSH_ROUNDS - rush.rounds;
  const quit = () => { if (phase === 'play') end(); else onClose(); };
  return (
    <div className="rush" role="dialog" aria-modal="true" aria-label={t('rush.title')}>
      <div className="rush-top">
        <button className="btn btn-ghost" onClick={quit}>{phase === 'play' ? t('rush.skip') : t('rush.close')}</button>
        {phase === 'play' && <div className="rush-stats mono">
          <span aria-label={t('rush.timeAria')}>{view.secLeft}s</span>
          <span>{t('rush.score', { n: view.points })}</span>
        </div>}
      </div>
      {phase === 'intro' && (
        <div className="rush-card">
          <h2>{t('rush.title')}</h2>
          <p className="sub">{t('rush.sub')}</p>
          <ul className="rush-how">
            <li><i className="rush-ico n" />{t('rush.howTap')}</li>
            <li><i className="rush-ico f" />{t('rush.howHold')}</li>
            <li><i className="rush-ico s" />{t('rush.howSwipe')}</li>
          </ul>
          <p className="sub">{t('rush.rules')}</p>
          <button className="btn btn-primary rush-go" onClick={begin}>{t('rush.start')}</button>
          <div className="sub">{t('rush.roundsLeft', { n: roundsLeft })}</div>
        </div>
      )}
      {phase === 'play' && (
        <>
          <div className="rush-meter">
            <div className="rush-bar"><i style={{ width: `${Math.min(100, (view.combo / 30) * 100)}%` }} /></div>
            <span className={'mono rush-mult' + (mult >= 3 ? ' max' : '')}>{t('rush.combo', { n: view.combo })} · ×{mult.toFixed(1)}</span>
          </div>
          <div className="rush-msg" key={view.msg?.id ?? 0}>{view.msg && <span className={view.msg.bad ? 'bad' : ''}>{view.msg.text}</span>}</div>
          <div className={'rush-pile' + (view.shake ? ' shake' + (view.shake % 2) : '')}>
            {view.docs.map((d) => (
              <div
                key={d.id}
                className={`rush-doc ${d.kind}${d.left < 0.25 ? ' urgent' : ''}`}
                onPointerDown={(e) => onDown(e, d)}
                onPointerMove={(e) => onMove(e, d)}
                onPointerUp={(e) => onUp(e, d)}
                onPointerCancel={() => { press.current = null; }}
                role="button"
                aria-label={t(d.kind === 'normal' ? 'rush.howTap' : d.kind === 'flag' ? 'rush.howHold' : 'rush.howSwipe')}
              >
                <div className="rush-doc-head">
                  <b>{d.kind === 'flag' ? t('rush.flagged') : d.kind === 'special' ? t('rush.gold') : t('rush.form', { n: d.id })}</b>
                  <span>{d.kind === 'flag' ? t('rush.holdHint') : d.kind === 'special' ? t('rush.swipeHint') : t('rush.tapHint')}</span>
                </div>
                <div className="rush-lines"><i /><i /><i /></div>
                {d.kind === 'flag' && <div className="rush-hold"><i style={{ width: `${d.hold * 100}%` }} /></div>}
                <div className="rush-life"><i style={{ width: `${Math.max(0, d.left) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </>
      )}
      {phase === 'done' && reward && (
        <div className="rush-card">
          <h2>{t('rush.done')}</h2>
          <div className="rush-result mono">
            <span>{t('rush.score', { n: reward.points })}</span>
            <span>{t('rush.bestCombo', { n: reward.best })}</span>
          </div>
          <div className="rush-pay mono">+{formatNumber(reward.souls)} {t('rush.souls')}<br />+{formatNumber(reward.kc)} KC</div>
          <p className="sub">{t('rush.onTop')}</p>
          {cooling
            ? <p className="sub">{t('rush.breakNote')}</p>
            : <button className="btn btn-primary rush-go" onClick={() => { setReward(null); setPhase('intro'); }}>{t('rush.again')}</button>}
        </div>
      )}
    </div>
  );
}
