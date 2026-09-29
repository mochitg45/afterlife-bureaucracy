import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/game';
import './Visitor.css';

/** How long Pip loops over the office before flying off untapped. */
export const FLIGHT_MS = 20_000;
const LOOP_MS = 9_000;
const FRAME_MS = 90;
const FLAP = [1, 2, 3, 2];
const BOB = [0, 2, 4, 2];
export const PIP_LINES = [
  'Special delivery!',
  'Tap me! Blessing inside',
  'Mail from upstairs!',
  'Sign here. And here. And here.',
  'Form 7-B, in triplicate!',
  'Heaven says hi!',
];
export const pipFrameUrl = (n: number) => `${import.meta.env.BASE_URL}art/flyers/pip-${n}.webp`;

/**
 * Pip, the flying courier. Polls the store once a second; when a visit is due he loops over
 * the office for FLIGHT_MS with a speech bubble. Tapping opens his gift (the store decides
 * the amount); flying off untapped just books the next visit.
 */
export function Visitor() {
  const visitorDue = useGame((s) => s.visitorDue);
  const openVisitor = useGame((s) => s.openVisitor);
  const missVisitor = useGame((s) => s.missVisitor);
  const [flying, setFlying] = useState(false);
  const [line, setLine] = useState(0);
  const pip = useRef<HTMLButtonElement>(null);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (flying) return;
    const id = setInterval(() => {
      if (visitorDue()) {
        setLine((l) => (l + 1) % PIP_LINES.length);
        setFlying(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [flying, visitorDue]);

  useEffect(() => {
    if (!flying) return;
    const start = performance.now();
    let raf = 0;
    let shown = -1;
    const step = (now: number) => {
      const t = now - start;
      if (t >= FLIGHT_MS) {
        missVisitor();
        setFlying(false);
        return;
      }
      const el = pip.current;
      if (el) {
        const k = Math.floor(t / FRAME_MS) % 4;
        if (k !== shown && img.current) { img.current.src = pipFrameUrl(FLAP[k]); shown = k; }
        const W = window.innerWidth, H = window.innerHeight, a = (2 * Math.PI * t) / LOOP_MS;
        const x = W / 2 + W * 0.36 * Math.sin(a) - el.offsetWidth / 2;
        const y = H * 0.42 + H * 0.12 * Math.sin(2 * a) - el.offsetHeight / 2 + BOB[k];
        el.style.transform = `translate(${x}px, ${y}px)`;
        el.dataset.dir = Math.cos(a) < 0 ? 'left' : 'right';
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const lines = setInterval(() => setLine((l) => (l + 1) % PIP_LINES.length), 4_500);
    return () => { cancelAnimationFrame(raf); clearInterval(lines); };
  }, [flying, missVisitor]);

  if (!flying) return null;
  return (
    <button
      ref={pip}
      className="visitor"
      aria-label="Pip the courier has a delivery. Tap to open it."
      onClick={() => { openVisitor(); setFlying(false); }}
    >
      <span className="visitor-bubble" aria-hidden>{PIP_LINES[line]}</span>
      <img ref={img} className="visitor-pip" src={pipFrameUrl(1)} alt="" />
    </button>
  );
}
