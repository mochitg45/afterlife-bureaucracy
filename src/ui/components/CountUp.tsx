import { useEffect, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts a whole number up from 0 for the ceremonies. `render` formats it. While counting, a
 * visually hidden copy carries the final figure so screen readers (and tests) never see a
 * half-counted number.
 */
export function CountUp({ to, render, delay = 500, ms = 1100 }: { to: number; render: (n: number) => string; delay?: number; ms?: number }) {
  const [n, setN] = useState(() => (reduced() ? to : 0));
  useEffect(() => {
    if (reduced() || to <= 0) { setN(to); return; }
    let raf = 0;
    let t0 = 0;
    const start = window.setTimeout(() => {
      const step = (now: number) => {
        if (!t0) t0 = now;
        const p = Math.min(1, (now - t0) / ms);
        setN(Math.round(to * (1 - (1 - p) ** 3)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(start); cancelAnimationFrame(raf); };
  }, [to, delay, ms]);
  const final = render(to);
  return n === to
    ? <>{final}</>
    : <><span className="visually-hidden">{final}</span><span aria-hidden="true">{render(n)}</span></>;
}
