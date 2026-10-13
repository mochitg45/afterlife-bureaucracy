import { useEffect, useRef, useState } from 'react';
import { content } from '../../data';
import { useGame } from '../../store/game';
import { Character } from '../characters/Character';
import { onStamp } from '../stampEvents';
import { ANIMS } from '../anim/manifest';
import { SpriteAnim, type Reaction } from '../anim/SpriteAnim';
import { soulCard } from './soulFace';
import faceCounts from '../../data/soul-faces.json';
import head from '../../../public/art/anim/soul/head.json';
import './LivingOffice.css';

const FACE_IDS = Object.entries(faceCounts as Record<string, number>)
  .flatMap(([k, n]) => Array.from({ length: n }, (_, i) => `${k}-${String(i + 1).padStart(2, '0')}`));
const faceUrl = (id: string) => `${import.meta.env.BASE_URL}art/souls/${id}.webp`;
const randomFace = () => faceUrl(FACE_IDS[Math.floor(Math.random() * FACE_IDS.length)]);

/** A queued or departing soul: the soul's face inside a glowing spirit bubble with a wispy tail. */
function Soul({ face, phase = 0, fallback }: { face?: string; phase?: number; fallback: JSX.Element }) {
  if (!ANIMS.soul?.walk || !face) return fallback;
  // head.json is measured on the 192 px frame canvas: the face sits in the orb, under its shine.
  const size = (head.headSize / 192) * 100;
  const box = { width: `${size}%`, left: `${(head.headCenterX / 192) * 100 - size / 2}%`, top: `${(head.headCenterY / 192) * 100 - size / 2}%` };
  return (
    <div className="lo-soulbody">
      <SpriteAnim id="soul" clip="walk" phase={phase} fallback={fallback} />
      <img className="lo-face" src={face} alt="" draggable={false} style={box} />
      <img className="lo-shine" src={`${import.meta.env.BASE_URL}art/anim/soul/shine.webp`} alt="" draggable={false} />
    </div>
  );
}

/** [left %, bottom %] slots on either side of the stamp, so staff never cover it. */
const SLOTS: [number, number][] = [[3, 34], [80, 8], [80, 34], [3, 58]];
/** Hop timing per slot so the crew never moves in lockstep: [delay s, duration s]. */
const HOPS: [number, number][] = [[0, 1.6], [0.5, 1.9], [0.9, 1.7], [0.3, 2.1]];
const QUEUE = [0, 1, 2];
const MAX_DEPARTING = 6;
const DEPART_MS = 850;

interface Departing { key: number; up: boolean; golden: boolean; face?: string }

export function LivingOffice({ dept }: { dept: string }) {
  const staffCounts = useGame((s) => s.state.staff);
  // An unknown id (an old save, a test) shows the intake crew rather than crashing the scene.
  const defs = (content.departments.find((d) => d.id === dept) ?? content.departments[0]).staff;
  const hired = defs.filter((d) => (staffCounts[d.id] ?? 0) > 0).slice(0, 4);

  const [departing, setDeparting] = useState<Departing[]>([]);
  const [busy, setBusy] = useState(0);
  const seq = useRef(0);
  // Per-staff one-shot reactions; a staff member ignores stamps until theirs has finished.
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const playing = useRef(new Set<string>());
  const hiredIds = useRef<string[]>([]);
  hiredIds.current = hired.map((d) => d.id);
  const walk = !!ANIMS.soul?.walk;
  const soul = <Character id="soul" mood="ok" size={64} />;
  // The front of the line is the soul on the "Now serving" card; the two behind it are random.
  const line = useGame((s) => s.queueLine);
  const front = soulCard(line).faces[0];
  const [behind, setBehind] = useState<string[]>(() => [randomFace(), randomFace()]);
  const frontRef = useRef(front);
  frontRef.current = front;

  useEffect(() => onStamp((e) => {
    const up = dept === 'hell' ? false : dept === 'intake' ? Math.random() < 0.5 : true;
    const key = ++seq.current;
    setDeparting((d) => [...d, { key, up, golden: e.golden, face: frontRef.current }].slice(-MAX_DEPARTING));
    setBehind((b) => [b[1], randomFace()]);
    setBusy(key);
    const clip = up ? 'happy' : 'true';
    for (const id of hiredIds.current) {
      if (!ANIMS[id]?.[clip] || playing.current.has(id)) continue;
      playing.current.add(id);
      setReactions((r) => ({ ...r, [id]: { clip, key } }));
    }
    window.setTimeout(() => setDeparting((d) => d.filter((x) => x.key !== key)), DEPART_MS);
  }), [dept]);

  return (
    <div className="living-office" aria-hidden="true">
      {hired.map((d, i) => {
        const pos = { left: `${SLOTS[i][0]}%`, bottom: `${SLOTS[i][1]}%` };
        const still = <Character id={d.id} mood="ok" size={64} art={d.id} />;
        if (ANIMS[d.id]?.work) {
          return (
            <div key={d.id} className="lo-staff lo-anim" style={pos} data-staff={d.id}>
              <SpriteAnim id={d.id} phase={i * 3} reaction={reactions[d.id]} fallback={still}
                onReactionEnd={() => playing.current.delete(d.id)} />
            </div>
          );
        }
        return (
          <div key={d.id} className="lo-staff" style={pos} data-staff={d.id}>
            {/* re-keyed on each stamp to replay the busy squash */}
            <div className="lo-busy" key={busy}>
              <div className="lo-hop" style={{ animationDelay: `${HOPS[i][0]}s`, animationDuration: `${HOPS[i][1]}s` }}>
                {still}
              </div>
            </div>
          </div>
        );
      })}
      <div className="lo-queue" key={busy}>
        {QUEUE.map((i) => (
          <div key={i} className="lo-soul" style={{ left: `${i * 8}%` }}>
            <div className={walk ? 'lo-walk' : 'lo-wait'} style={{ animationDelay: `${i * 0.35}s` }}>
              {walk ? <Soul face={i === QUEUE.length - 1 ? front ?? behind[0] : behind[i]} phase={i * 3} fallback={soul} /> : soul}
            </div>
          </div>
        ))}
      </div>
      {departing.map((x) => (
        <div key={x.key} className={`lo-leave ${x.up ? 'up' : 'down'}${x.golden ? ' gold' : ''}`} data-departing={x.up ? 'up' : 'down'}>
          {x.up ? <span className="lo-halo" /> : <span className="lo-ember" />}
          {walk ? <Soul face={x.face} fallback={soul} /> : soul}
        </div>
      ))}
    </div>
  );
}
