import { useState } from 'react';
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';

interface Float { id: number; x: number; text: string }

export function StampButton() {
  const stamp = useGame((s) => s.stamp);
  const rotateQueue = useGame((s) => s.rotateQueue);
  const clickPower = useGame((s) => s.rates.clickPower);
  const [floats, setFloats] = useState<Float[]>([]);
  const [pressed, setPressed] = useState(false);

  const onStamp = () => {
    stamp();
    rotateQueue();
    setPressed(true);
    setTimeout(() => setPressed(false), 90);
    const f = { id: Date.now() + Math.random(), x: 30 + Math.random() * 40, text: '+' + formatNumber(clickPower) };
    setFloats((cur) => [...cur.slice(-6), f]);
    setTimeout(() => setFloats((cur) => cur.filter((x) => x.id !== f.id)), 700);
  };

  return (
    <div className="stamp-wrap">
      {floats.map((f) => <span key={f.id} className="float mono" style={{ left: f.x + '%' }}>{f.text}</span>)}
      <button className={'stamp' + (pressed ? ' pressed' : '')} onPointerDown={onStamp} aria-label="Stamp soul">
        <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
          <circle cx="60" cy="60" r="54" fill="var(--red)" stroke="var(--ink)" strokeWidth="4" />
          <circle cx="60" cy="60" r="42" fill="none" stroke="var(--surface)" strokeWidth="3" strokeDasharray="6 5" />
          <text x="60" y="56" textAnchor="middle" fill="var(--surface)" fontFamily="var(--font-display)" fontSize="18">PROCESSED</text>
          <text x="60" y="76" textAnchor="middle" fill="var(--surface)" fontFamily="var(--font-mono)" fontSize="12">FORM 7-B</text>
        </svg>
      </button>
      <div className="mono sub">+{formatNumber(clickPower)} per stamp</div>
    </div>
  );
}
