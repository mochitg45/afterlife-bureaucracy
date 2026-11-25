import { useEffect, useState, type ReactNode } from 'react';
import { t } from '../../i18n';
import { content } from '../../data';
import { useGame, TRAINING_DONE } from '../../store/game';
import { findCard } from '../../engine/content';
import { formatNumber } from '../../engine/format';
import { MISSION_SLOTS, cardPower, freeCards, missionIn, missionMult, missionPlace } from '../../engine/missions';
import { CARE_KINDS, adopted, canCare, careWait, petCareMult, petLevel, type CareKind } from '../../engine/petcare';
import { FREE_PET, PREMIUM_STAFF, petOnDuty, premiumDef } from '../../engine/premium';
import { DESK_COUNT, PAIR_BONUS, deskBonus, deskPairs, deskSeats, type PairKind } from '../../engine/desks';
import { Character } from '../characters/Character';
import { SpriteAnim, type Reaction } from '../anim/SpriteAnim';
import { Modal } from './Modal';
import { CardTile } from './CardTile';
import { fmtLeft } from '../format';
import './BreakRoom.css';

const art = (n: string) => `${import.meta.env.BASE_URL}art/ui/${n}.webp`;
const signed = (v: number) => `${v < 0 ? '−' : '+'}${Math.round(Math.abs(v) * 100)}%`;

/** A wall clock that re-renders its owner every `ms`. */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

/* ------------------------------------------------------------- Field Missions */

function MissionRow({ slot, now, picked, onToggle, onSent }: { slot: number; now: number; picked: string[]; onToggle: (id: string) => void; onSent: () => void }) {
  const state = useGame((s) => s.state);
  const suspect = useGame((s) => s.clockSuspect);
  const start = useGame((s) => s.startMission);
  const collect = useGame((s) => s.collectMission);
  const recall = useGame((s) => s.recallMission);
  const [got, setGot] = useState('');
  const [choosing, setChoosing] = useState(false);
  const def = MISSION_SLOTS[slot];
  const m = missionIn(state, slot);
  const place = m?.place ?? missionPlace(state, slot);
  const team = m?.cards ?? picked;
  const left = m ? m.endsWall - now : 0;
  const free = freeCards(state, content).sort((a, b) => cardPower(state, content, b, place) - cardPower(state, content, a, place));
  const name = t(`missions.place.${place}`);

  return (
    <article className="card br-mission" data-mission={slot}>
      <img className="br-place" src={art(`place-${place}`)} alt="" draggable={false} />
      <div className="br-mission-body">
        <strong>{name}</strong>
        <span className="sub">{t(`missions.len.${slot}`)} · {content.departments.find((d) => d.id === place)?.name ?? place}</span>
        <span className="sub">{t('missions.pays', { min: Math.round(def.souls / 60), treats: def.treats })}{def.vouchers > 0 && ' · ' + t('missions.vouchers', { n: def.vouchers })}</span>
        {team.length > 0 && <span className="mono brass">{t('missions.team', { n: team.length, max: def.team, mult: missionMult(state, content, slot, place, team).toFixed(1) })}</span>}
      </div>
      {m ? (
        <div className="br-mission-actions">
          <div className="br-away">{m.cards.map((id) => <Character key={id} id={findCard(content, id).character} art={id} mood="ok" size={40} />)}</div>
          {left > 0 ? (
            <>
              <span className="mono sub">{t('missions.back', { time: fmtLeft(left) })}</span>
              <button type="button" className="btn btn-ghost" onClick={() => recall(slot)}>{t('missions.recall')}</button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" disabled={suspect} onClick={() => {
              const r = collect(slot);
              if (r) setGot(t('missions.got', { souls: formatNumber(r.souls), treats: r.treats }) + (r.vouchers ? ' · ' + t('missions.vouchers', { n: r.vouchers }) : ''));
            }}>{t('missions.collect')}</button>
          )}
        </div>
      ) : (
        <div className="br-mission-actions">
          {choosing && (
            <div className="br-picker">
              {free.length === 0 && <p className="sub">{t('missions.noCards')}</p>}
              {free.map((id) => {
                const c = findCard(content, id);
                const on = picked.includes(id);
                return (
                  <button key={id} type="button" className={'br-pick' + (on ? ' on' : '') + (c.dept === place ? ' match' : '')} aria-pressed={on}
                    aria-label={`${c.name}, ${c.title}`} disabled={!on && picked.length >= def.team} onClick={() => onToggle(id)}>
                    <Character id={c.character} art={id} mood="ok" size={44} />
                    <span>{c.name}</span>
                    {c.dept === place && <span className="br-x mono">×1.5</span>}
                  </button>
                );
              })}
            </div>
          )}
          <button type="button" className="btn btn-primary" disabled={suspect || (choosing && picked.length === 0)} onClick={() => {
            if (!choosing) { setGot(''); setChoosing(true); return; }
            if (start(slot, picked)) { setChoosing(false); onSent(); }
          }}>{choosing ? t('missions.send') : t('missions.choose')}</button>
        </div>
      )}
      {got && <p className="br-got" role="status">{got}</p>}
    </article>
  );
}

export function MissionsSheet({ onClose }: { onClose: () => void }) {
  const now = useNow(1000);
  const suspect = useGame((s) => s.clockSuspect);
  const [picks, setPicks] = useState<string[][]>(() => MISSION_SLOTS.map(() => []));
  // A card picked for one trip drops out of the others, so it is never promised twice.
  const toggle = (slot: number, id: string) => setPicks((p) => p.map((l, i) => (i === slot ? (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]) : l.filter((x) => x !== id))));
  return (
    <Modal open title={t('missions.title')} className="br-sheet" onClose={onClose}>
      <p className="sub">{t('missions.intro')}</p>
      {suspect && <p className="sub warn" role="status">{t('missions.clock')}</p>}
      {MISSION_SLOTS.map((_, slot) => (
        <MissionRow key={slot} slot={slot} now={now} picked={picks[slot]} onToggle={(id) => toggle(slot, id)}
          onSent={() => setPicks((p) => p.map((l, i) => (i === slot ? [] : l)))} />
      ))}
      <button type="button" className="btn btn-ghost" onClick={onClose}>{t('postcard.close')}</button>
    </Modal>
  );
}

/* ------------------------------------------------------------------- Pet Care */

const PET_IDS = [FREE_PET.id, ...PREMIUM_STAFF.filter((p) => p.slot === 'pet').map((p) => p.id)];

export function PetSheet({ onClose }: { onClose: () => void }) {
  const now = useNow(1000);
  const state = useGame((s) => s.state);
  const suspect = useGame((s) => s.clockSuspect);
  const adopt = useGame((s) => s.adoptPet);
  const care = useGame((s) => s.carePet);
  const setPremium = useGame((s) => s.setPremium);
  const owned = PET_IDS.filter((id) => (state.entitlements.premium ?? []).includes(id));
  const onDuty = petOnDuty(state)?.id;
  const [chosen, setChosen] = useState<string | null>(null);
  const [play, setPlay] = useState<Reaction | null>(null);
  const id = chosen && owned.includes(chosen) ? chosen : onDuty ?? owned[0];
  const isFree = adopted(state);

  const give = (kind: CareKind) => { if (id && care(id, kind)) setPlay({ clip: 'bark', key: Date.now() }); };
  const lvl = id ? petLevel(state, id) : null;

  return (
    <Modal open title={t('pets.title')} className="br-sheet" onClose={onClose}>
      {!isFree && (
        <div className="card br-adopt">
          <img src={`${import.meta.env.BASE_URL}art/chars/${FREE_PET.id}.webp`} alt="" />
          <div>
            <strong>{t('pets.adoptTitle')}</strong>
            <p className="sub">{t('pets.adoptBody')}</p>
            <button type="button" className="btn btn-primary" onClick={() => { adopt(); setChosen(FREE_PET.id); }}>{t('pets.adopt')}</button>
          </div>
        </div>
      )}
      {owned.length > 1 && (
        <div className="br-pets" role="group" aria-label={t('pets.title')}>
          {owned.map((p) => (
            <button key={p} type="button" className={'br-pet' + (p === id ? ' on' : '')} aria-pressed={p === id} onClick={() => setChosen(p)} aria-label={t(`premium.${p}.name`)}>
              <img src={`${import.meta.env.BASE_URL}art/chars/${p}.webp`} alt="" />
            </button>
          ))}
        </div>
      )}
      {id && lvl && (
        <>
          <div className="br-stage" data-pet={id}>
            <SpriteAnim key={id} id={id} clip="walk" reaction={play} fallback={<img src={`${import.meta.env.BASE_URL}art/chars/${id}.webp`} alt="" />} />
          </div>
          <div className="br-petline">
            <strong>{t(`premium.${id}.name`)}</strong>
            <span className="mono">{t('pets.level', { n: lvl.level })}</span>
            <span className="mono">{t('pets.treats', { n: state.pets.treats })}</span>
          </div>
          <div className="br-bar" aria-hidden="true"><span style={{ width: `${lvl.need ? Math.min(100, (lvl.xp / lvl.need) * 100) : 100}%` }} /></div>
          <p className="sub">{lvl.need ? t('pets.toNext', { have: lvl.xp, need: lvl.need }) : t('pets.max')}</p>
          <p className="sub brass">{id === onDuty
            ? t('pets.bonus', { pct: signed((1 + (premiumDef(id)?.globalMult ?? 0)) * petCareMult(state) - 1) })
            : t('pets.offDuty')}</p>
          <div className="br-care">
            {CARE_KINDS.map((kind) => {
              const wait = careWait(state, id, kind, now);
              return (
                <button key={kind} type="button" className="btn" disabled={suspect || !canCare(state, id, kind, now)} onClick={() => give(kind)}>
                  <span>{t(`pets.${kind}`)}</span>
                  <span className="sub mono">{wait > 0 ? fmtLeft(wait) : t(`pets.${kind}Note`)}</span>
                </button>
              );
            })}
          </div>
          {id !== onDuty && <button type="button" className="btn btn-primary" onClick={() => setPremium(id, 'pet')}>{t('premium.onDuty')}</button>}
        </>
      )}
      {suspect && <p className="sub warn" role="status">{t('missions.clock')}</p>}
      <button type="button" className="btn btn-ghost" onClick={onClose}>{t('postcard.close')}</button>
    </Modal>
  );
}

/* --------------------------------------------------------------- Desk Planner */

const PAIRS: PairKind[] = ['team', 'mentor', 'rival'];

export function DeskSheet({ onClose }: { onClose: () => void }) {
  const state = useGame((s) => s.state);
  const seat = useGame((s) => s.seatCard);
  const clear = useGame((s) => s.clearDesks);
  const [held, setHeld] = useState<string | null>(null);
  const seats = deskSeats(state);
  const waiting = state.equipped.filter((id) => !seats.includes(id));
  const pairs = deskPairs(state, content);
  const bonus = deskBonus(state, content);
  const holding = held && state.equipped.includes(held) ? held : null;

  const tapDesk = (i: number) => {
    const here = seats[i];
    if (!holding) { if (here) setHeld(here); return; }
    if (here === holding) seat(holding, null); else seat(holding, i);
    setHeld(null);
  };

  return (
    <Modal open title={t('desks.title')} className="br-sheet" onClose={onClose}>
      <p className="sub">{t('desks.intro')}</p>
      <p className={'br-total mono' + (bonus < 0 ? ' bad' : '')} role="status">{t('desks.total', { pct: signed(bonus) })}</p>
      <div className="br-floor">
        {Array.from({ length: DESK_COUNT }, (_, i) => {
          const id = seats[i];
          const mine = pairs.filter((p) => p.a === i || p.b === i);
          const c = id ? findCard(content, id) : null;
          const net = mine.reduce((n, p) => n + PAIR_BONUS[p.kind], 0);
          return (
            <button key={i} type="button" data-desk={i} className={'br-desk' + (c ? ' taken' : '') + (id && id === holding ? ' held' : '')} onClick={() => tapDesk(i)}
              aria-label={c ? t('desks.seat', { n: i + 1, name: c.name }) : t('desks.empty', { n: i + 1 })}>
              {c && <Character id={c.character} art={c.id} mood="ok" size={48} />}
              {c && <span className="br-desk-name">{c.name}</span>}
              {net !== 0 && <span className={'br-net mono' + (net < 0 ? ' bad' : '')}>{signed(net)}</span>}
            </button>
          );
        })}
      </div>
      <p className="sub">{holding ? t('desks.place', { name: findCard(content, holding).name }) : t('desks.hint')}</p>
      {state.equipped.length === 0 && <p className="sub warn">{t('desks.noCards')}</p>}
      {waiting.length > 0 && (
        <div className="tile-grid br-waiting">
          {waiting.map((id) => (
            <CardTile key={id} card={findCard(content, id)} stars={state.cards[id] ?? 1} owned equipped={id === holding} size={40} onClick={() => setHeld(id === holding ? null : id)} />
          ))}
        </div>
      )}
      <ul className="br-rules sub">{PAIRS.map((k) => <li key={k} className={k === 'rival' ? 'bad' : ''}>{t(`desks.rule.${k}`, { pct: signed(PAIR_BONUS[k]) })}</li>)}</ul>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" disabled={seats.every((x) => !x)} onClick={() => { clear(); setHeld(null); }}>{t('desks.clear')}</button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>{t('postcard.close')}</button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------- The Office row */

type Sheet = 'missions' | 'pets' | 'desks';

function Entry({ kind, badge, onOpen }: { kind: Sheet; badge: ReactNode; onOpen: (k: Sheet) => void }) {
  return (
    <button type="button" className="br-entry" data-breakroom={kind} onClick={() => onOpen(kind)}>
      <img src={art(`br-${kind}`)} alt="" draggable={false} />
      <span>{t(`${kind}.title`)}</span>
      {badge ? <span className="br-badge" aria-hidden="true">{badge}</span> : null}
    </button>
  );
}

/** Field Missions, Pet Care and the Desk Planner. A badge counts what is ready to do right now. */
export function BreakRoom() {
  const trained = useGame((s) => s.state.onboarding.trainingStep >= TRAINING_DONE);
  const now = useNow(5000);
  const ready = useGame((s) => s.state.missions.active.filter((m) => m.endsWall <= now).length);
  const petTodo = useGame((s) => {
    if (!adopted(s.state)) return 1;
    const id = petOnDuty(s.state)?.id;
    return id ? CARE_KINDS.filter((k) => canCare(s.state, id, k, now)).length : 0;
  });
  const standing = useGame((s) => { const seats = deskSeats(s.state); return s.state.equipped.filter((id) => !seats.includes(id)).length; });
  const [open, setOpen] = useState<Sheet | null>(null);
  if (!trained) return null;
  const close = () => setOpen(null);
  return (
    <>
      <div className="br-row">
        <Entry kind="missions" badge={ready} onOpen={setOpen} />
        <Entry kind="pets" badge={petTodo} onOpen={setOpen} />
        <Entry kind="desks" badge={standing} onOpen={setOpen} />
      </div>
      {open === 'missions' && <MissionsSheet onClose={close} />}
      {open === 'pets' && <PetSheet onClose={close} />}
      {open === 'desks' && <DeskSheet onClose={close} />}
    </>
  );
}
