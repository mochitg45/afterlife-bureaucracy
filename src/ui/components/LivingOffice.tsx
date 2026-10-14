import { useEffect, useRef, useState } from 'react';
import { content } from '../../data';
import { useGame } from '../../store/game';
import { Character } from '../characters/Character';
import { onStamp } from '../stampEvents';
import { ANIMS } from '../anim/manifest';
import { SpriteAnim, type Reaction } from '../anim/SpriteAnim';
import { ART } from '../characters/art';
import { keptCard } from '../../engine/gacha';
import { soulCard } from './soulFace';
import faceCounts from '../../data/soul-faces.json';
import head from '../../../public/art/anim/soul/head.json';
import './LivingOffice.css';

const FACE_IDS = Object.entries(faceCounts as Record<string, number>)
  .flatMap(([k, n]) => Array.from({ length: n }, (_, i) => `${k}-${String(i + 1).padStart(2, '0')}`));
const faceUrl = (id: string) => `${import.meta.env.BASE_URL}art/souls/${id}.webp`;
const randomFace = () => faceUrl(FACE_IDS[Math.floor(Math.random() * FACE_IDS.length)]);

/** A soul: its face inside a glowing spirit bubble, with the bubble's shine laid over the face. */
function Soul({ face, fallback }: { face?: string; fallback: JSX.Element }) {
  if (!face) return fallback;
  const base = `${import.meta.env.BASE_URL}art/anim/soul/`;
  return (
    <div className="lo-soulbody">
      <img src={`${base}orb.webp`} alt="" draggable={false} />
      <img className="lo-face" src={face} alt="" draggable={false} />
      <img className="lo-shine" src={`${base}orb-shine.webp`} alt="" draggable={false} />
    </div>
  );
}

/** [left %, bottom %] slots on either side of the stamp, so staff never cover it. */
const SLOTS: [number, number][] = [[3, 34], [80, 8], [80, 34], [3, 58]];
/** Hop timing per slot so the crew never moves in lockstep: [delay s, duration s]. */
const HOPS: [number, number][] = [[0, 1.6], [0.5, 1.9], [0.9, 1.7], [0.3, 2.1]];
const QUEUE = [0, 1, 2];
const MAX_DEPARTING = 6;
const DEPART_MS = 1300;

const RANK: Record<string, number> = { temp: 0, fulltime: 1, senior: 2, executive: 3 };
const MAX_CARDS = 2;
const artName = (id: string) => ART[id] ?? id;

interface Member { id: string; art: string; rarity?: string }

/** Reincarnation sends a soul round the wheel: it swirls away and pops back out as one of these newborns. */
const BABIES = ['chick', 'kitten', 'puppy', 'bunny', 'piglet', 'frog'];
const REBORN_MS = 1700;

type Exit = 'up' | 'down' | 'reborn' | 'limbo' | 'valhalla';
const EXIT_MS: Partial<Record<Exit, number>> = { reborn: REBORN_MS, limbo: 1800 };
interface Departing { key: number; exit: Exit; golden: boolean; face?: string; baby: string }

export function LivingOffice({ dept }: { dept: string }) {
  const staffCounts = useGame((s) => s.state.staff);
  // An unknown id (an old save, a test) shows the intake crew rather than crashing the scene.
  const defs = (content.departments.find((d) => d.id === dept) ?? content.departments[0]).staff;
  const equipped = useGame((s) => s.state.equipped);
  // Up to 2 equipped gacha cards (best rarity first, never event cards); staff fill the rest, keeping the most senior.
  const cards = content.cards
    .filter((c) => equipped.includes(c.id) && keptCard(c))
    .sort((a, b) => RANK[b.rarity] - RANK[a.rarity])
    .slice(0, MAX_CARDS);
  // The department's first hire is its mascot (Dave in Intake, with his true face) and always stays;
  // the most senior of the rest fill what the cards leave.
  const owned = defs.filter((d) => (staffCounts[d.id] ?? 0) > 0);
  const room = 4 - cards.length;
  const staff = owned.length <= room ? owned : [owned[0], ...owned.slice(1).slice(-(room - 1))];
  const members: Member[] = [
    ...staff.map((d) => ({ id: d.id, art: artName(d.id) })),
    ...cards.map((c) => ({ id: c.id, art: artName(c.id), rarity: c.rarity })),
  ];

  const [departing, setDeparting] = useState<Departing[]>([]);
  const [busy, setBusy] = useState(0);
  const seq = useRef(0);
  // Per-staff one-shot reactions; a staff member ignores stamps until theirs has finished.
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const playing = useRef(new Set<string>());
  const crew = useRef<Member[]>([]);
  crew.current = members;
  const soul = <Character id="soul" mood="ok" size={64} />;
  // The front of the line is the soul on the "Now serving" card; the two behind it are random.
  const line = useGame((s) => s.queueLine);
  const front = soulCard(line).faces[0];
  const [behind, setBehind] = useState<string[]>(() => [randomFace(), randomFace()]);
  const frontRef = useRef(front);
  frontRef.current = front;

  useEffect(() => onStamp((e) => {
    const exit: Exit = dept === 'hell' ? 'down' : dept === 'reincarnation' ? 'reborn' : dept === 'limbo' ? 'limbo'
      : dept === 'valhalla' ? 'valhalla' : dept === 'intake' ? (Math.random() < 0.5 ? 'up' : 'down') : 'up';
    const key = ++seq.current;
    const baby = BABIES[Math.floor(Math.random() * BABIES.length)];
    setDeparting((d) => [...d, { key, exit, golden: e.golden, face: frontRef.current, baby }].slice(-MAX_DEPARTING));
    setBehind((b) => [b[1], randomFace()]);
    setBusy(key);
    const clip = exit === 'down' ? 'true' : 'happy';
    for (const { id, art } of crew.current) {
      if (!ANIMS[art]?.[clip] || playing.current.has(id)) continue;
      playing.current.add(id);
      setReactions((r) => ({ ...r, [id]: { clip, key } }));
    }
    window.setTimeout(() => setDeparting((d) => d.filter((x) => x.key !== key)), EXIT_MS[exit] ?? DEPART_MS);
  }), [dept]);

  return (
    <div className="living-office" aria-hidden="true">
      {members.map((m, i) => {
        const pos = { left: `${SLOTS[i][0]}%`, bottom: `${SLOTS[i][1]}%` };
        const still = <Character id={m.id} mood="ok" size={64} art={m.id} />;
        const glow = m.rarity && m.rarity !== 'temp' ? <span className={`lo-glow lo-glow-${m.rarity}`} /> : null;
        if (ANIMS[m.art]?.work) {
          return (
            <div key={m.id} className="lo-staff lo-anim" style={pos} data-staff={m.id}>
              {glow}
              <SpriteAnim id={m.art} phase={i * 3} reaction={reactions[m.id]} fallback={still}
                onReactionEnd={() => playing.current.delete(m.id)} />
            </div>
          );
        }
        return (
          <div key={m.id} className="lo-staff" style={pos} data-staff={m.id}>
            {glow}
            {/* re-keyed on each stamp to replay the busy squash */}
            <div className="lo-busy" key={busy}>
              {/* cards only breathe; staff hop */}
              <div className={m.rarity ? 'lo-breathe' : 'lo-hop'}
                style={m.rarity ? undefined : { animationDelay: `${HOPS[i][0]}s`, animationDuration: `${HOPS[i][1]}s` }}>
                {still}
              </div>
            </div>
          </div>
        );
      })}
      <div className="lo-queue" key={busy}>
        {QUEUE.map((i) => (
          <div key={i} className="lo-soul" style={{ left: `${2 + i * 13}%` }}>
            <div className="lo-wait" style={{ animationDelay: `${i * 0.35}s` }}>
              <Soul face={i === QUEUE.length - 1 ? front ?? behind[0] : behind[i]} fallback={soul} />
            </div>
          </div>
        ))}
      </div>
      {departing.map((x) => {
        const up = x.exit === 'up';
        const down = x.exit === 'down';
        return (
          <div key={x.key} className={`lo-leave ${x.exit}${x.golden ? ' gold' : ''}`} data-departing={x.exit}>
            {/* Heaven: wings, halo and a gold aura carry it up. Hell: it catches fire, chars and drops.
                Reincarnation: it swirls into the wheel and pops back out as a newborn. */}
            {up && <span className="lo-aura" />}
            {up && ANIMS.wings?.flap && <div className="lo-wings"><SpriteAnim id="wings" clip="flap" fallback={null} /></div>}
            {x.exit === 'reborn' && <span className="lo-swirl" />}
            {/* Valhalla: the Bifröst drops and the soul rides it up. Limbo: it greys out and is lost in the fog. */}
            {x.exit === 'valhalla' && <span className="lo-bifrost" />}
            <div className="lo-orb"><Soul face={x.face} fallback={soul} /></div>
            {up && <span className="lo-halo" />}
            {down && ANIMS.fire?.burn && <div className="lo-fire"><SpriteAnim id="fire" clip="burn" fallback={null} /></div>}
            {down && !ANIMS.fire?.burn && <span className="lo-ember" />}
            {x.exit === 'limbo' && <><span className="lo-fog a" /><span className="lo-fog b" /><span className="lo-fog c" /></>}
            {x.exit === 'reborn' && <><span className="lo-pop" /><img className="lo-baby" src={`art/anim/reborn/${x.baby}.webp`} alt="" /></>}
          </div>
        );
      })}
    </div>
  );
}
