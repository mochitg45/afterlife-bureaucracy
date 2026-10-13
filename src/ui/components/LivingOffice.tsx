import { useEffect, useRef, useState } from 'react';
import { content } from '../../data';
import { useGame } from '../../store/game';
import { Character } from '../characters/Character';
import { onStamp } from '../stampEvents';
import './LivingOffice.css';

/** [left %, bottom %] slots on either side of the stamp, so staff never cover it. */
const SLOTS: [number, number][] = [[3, 34], [80, 8], [80, 34], [3, 58]];
/** Hop timing per slot so the crew never moves in lockstep: [delay s, duration s]. */
const HOPS: [number, number][] = [[0, 1.6], [0.5, 1.9], [0.9, 1.7], [0.3, 2.1]];
const QUEUE = [0, 1, 2];
const MAX_DEPARTING = 6;
const DEPART_MS = 850;

interface Departing { key: number; up: boolean; golden: boolean }

export function LivingOffice({ dept }: { dept: string }) {
  const staffCounts = useGame((s) => s.state.staff);
  // An unknown id (an old save, a test) shows the intake crew rather than crashing the scene.
  const defs = (content.departments.find((d) => d.id === dept) ?? content.departments[0]).staff;
  const hired = defs.filter((d) => (staffCounts[d.id] ?? 0) > 0).slice(0, 4);

  const [departing, setDeparting] = useState<Departing[]>([]);
  const [busy, setBusy] = useState(0);
  const seq = useRef(0);

  useEffect(() => onStamp((e) => {
    const up = dept === 'hell' ? false : dept === 'intake' ? Math.random() < 0.5 : true;
    const key = ++seq.current;
    setDeparting((d) => [...d, { key, up, golden: e.golden }].slice(-MAX_DEPARTING));
    setBusy(key);
    window.setTimeout(() => setDeparting((d) => d.filter((x) => x.key !== key)), DEPART_MS);
  }), [dept]);

  return (
    <div className="living-office" aria-hidden="true">
      {hired.map((d, i) => (
        <div key={d.id} className="lo-staff" style={{ left: `${SLOTS[i][0]}%`, bottom: `${SLOTS[i][1]}%` }} data-staff={d.id}>
          {/* re-keyed on each stamp to replay the busy squash */}
          <div className="lo-busy" key={busy}>
            <div className="lo-hop" style={{ animationDelay: `${HOPS[i][0]}s`, animationDuration: `${HOPS[i][1]}s` }}>
              <Character id={d.id} mood="ok" size={64} art={d.id} />
            </div>
          </div>
        </div>
      ))}
      <div className="lo-queue" key={busy}>
        {QUEUE.map((i) => (
          <div key={i} className="lo-soul" style={{ left: `${i * 8}%` }}>
            <div className="lo-wait" style={{ animationDelay: `${i * 0.35}s` }}>
              <Character id="soul" mood="ok" size={64} />
            </div>
          </div>
        ))}
      </div>
      {departing.map((x) => (
        <div key={x.key} className={`lo-leave ${x.up ? 'up' : 'down'}${x.golden ? ' gold' : ''}`} data-departing={x.up ? 'up' : 'down'}>
          {x.up ? <span className="lo-halo" /> : <span className="lo-ember" />}
          <Character id="soul" mood="ok" size={64} />
        </div>
      ))}
    </div>
  );
}
