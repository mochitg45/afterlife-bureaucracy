import { useState } from 'react';
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { t } from '../../i18n';
import * as haptics from '../../platform/haptics';
import type { IncidentKind } from '../../engine/incidents';
import './OfficeIncidents.css';

const INK = '#3b2f2f';

/** Flat cartoon props, drawn inline (no emoji, no extra art files). */
function Prop({ kind }: { kind: IncidentKind }) {
  const sw = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
  switch (kind) {
    case 'printer':
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M14 20 L16 6 L34 4 L32 20 Z" fill="#fff" {...sw} />
          <path d="M18 10 L30 9 M18 14 L28 13" {...sw} strokeWidth={1.5} />
          <rect x="5" y="20" width="38" height="20" rx="4" fill="#9fb0c4" {...sw} />
          <rect x="11" y="32" width="26" height="4" rx="1" fill="#6c7c90" {...sw} strokeWidth={1.5} />
          <circle cx="37" cy="26" r="3" fill="#ef4b4b" {...sw} strokeWidth={1.5} />
        </svg>
      );
    case 'copier':
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <rect x="4" y="24" width="40" height="18" rx="4" fill="#b7c4a8" {...sw} />
          <rect x="8" y="22" width="32" height="5" rx="1" fill="#e8f0dc" {...sw} strokeWidth={1.5} />
          <path d="M13 22 C11 10 17 4 24 4 C31 4 37 10 35 22 L31 19 L27 22 L23 19 L19 22 Z" fill="#fff" fillOpacity=".92" {...sw} />
          <circle cx="20" cy="13" r="2" fill={INK} />
          <circle cx="29" cy="13" r="2" fill={INK} />
          <ellipse cx="24.5" cy="18" rx="2" ry="2.5" fill={INK} />
        </svg>
      );
    case 'coffee':
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <ellipse cx="25" cy="38" rx="21" ry="7" fill="#7a4a2b" {...sw} />
          <ellipse cx="38" cy="34" rx="4" ry="2.5" fill="#7a4a2b" {...sw} strokeWidth={1.5} />
          <g transform="rotate(-70 18 24)">
            <path d="M8 12 H28 L26 34 H10 Z" fill="#fff" {...sw} />
            <path d="M28 16 C36 16 36 28 27 28" fill="none" {...sw} />
          </g>
        </svg>
      );
    case 'queue':
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M6 36 C16 8 24 40 30 14 C34 4 44 20 40 34 C38 40 22 40 24 28" fill="none" {...sw} stroke="#e8923c" strokeWidth={5} />
          <path d="M6 36 C16 8 24 40 30 14 C34 4 44 20 40 34 C38 40 22 40 24 28" fill="none" {...sw} strokeWidth={1.5} />
          {[[8, 36], [30, 14], [40, 34]].map(([x, y]) => (
            <g key={x}>
              <circle cx={x} cy={y} r="6" fill="#dff3ff" {...sw} />
              <circle cx={x - 2} cy={y - 1} r="1" fill={INK} />
              <circle cx={x + 2} cy={y - 1} r="1" fill={INK} />
            </g>
          ))}
        </svg>
      );
    case 'lights':
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M16 4 H32 L36 14 H12 Z" fill="#fff6b0" {...sw} />
          <path d="M14 14 H34 L24 44 Z" fill="#fff6b0" fillOpacity=".5" {...sw} strokeWidth={1.5} strokeDasharray="3 4" />
          <path d="M26 17 L21 28 L27 28 L22 40" fill="none" stroke="#f0a020" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

interface Pop { id: number; text: string; x: number; y: number }

/** Interactive layer over the office scene: tap an incident a few times to fix it. */
export function OfficeIncidents() {
  const incidents = useGame((s) => s.incidents);
  const tapIncident = useGame((s) => s.tapIncident);
  const [pops, setPops] = useState<Pop[]>([]);

  const onTap = (id: number, x: number, y: number) => {
    const r = tapIncident(id);
    if (!r) return;
    if (!r.done) { haptics.tap(); return; }
    haptics.heavy();
    if (r.souls.lte(0)) return;
    const pop = { id: Date.now() + id, text: t('incident.pop', { n: formatNumber(r.souls) }), x, y };
    setPops((cur) => [...cur.slice(-3), pop]);
    setTimeout(() => setPops((cur) => cur.filter((p) => p.id !== pop.id)), 1200);
  };

  return (
    <div className="oi-layer">
      {incidents.map((i) => (
        <button key={i.id} type="button" className="oi-item" data-incident={i.kind}
          style={{ left: `${i.x}%`, top: `${i.y}%` }}
          aria-label={`${t(`incident.${i.kind}`)}. ${t('incident.hint', { n: i.need - i.taps })}`}
          onClick={() => onTap(i.id, i.x, i.y)}>
          <span className="oi-prop" key={i.taps}><Prop kind={i.kind} /></span>
          <span className="oi-pips" aria-hidden="true">
            {Array.from({ length: i.need }, (_, k) => <i key={k} className={k < i.taps ? 'on' : ''} />)}
          </span>
        </button>
      ))}
      {pops.map((p) => <span key={p.id} className="oi-pop" style={{ left: `${p.x}%`, top: `${p.y}%` }}>{p.text}</span>)}
    </div>
  );
}
