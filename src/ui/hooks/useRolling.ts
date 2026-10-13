import Decimal from 'break_infinity.js';
import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '../../engine/format';

const DUR = 400;
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Tweens the displayed value toward `value` over ~400ms and returns it formatted. Linear for
 * nearby values, log space when the change spans orders of magnitude. `bump` is true for one
 * beat after a jump of 10% or more. Only re-renders when the formatted text changes.
 */
export function useRolling(value: Decimal): { text: string; bump: boolean } {
  const [text, setText] = useState(() => formatNumber(value));
  const [bump, setBump] = useState(false);
  const shown = useRef(value);
  const target = useRef(value);
  const anim = useRef<{ from: Decimal; t0: number } | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    const prev = target.current;
    target.current = value;
    if (value.eq(prev)) return;
    if (prev.gt(0) && value.gt(prev.mul(1.1)) && value.sub(prev).gte(10)) {
      setBump(true);
      window.setTimeout(() => setBump(false), 300);
    }
    const snap = value.sub(shown.current).abs().lt(1) || value.lt(shown.current) || reduced();
    cancelAnimationFrame(raf.current);
    if (snap) {
      anim.current = null;
      shown.current = value;
      setText((old) => { const n = formatNumber(value); return n === old ? old : n; });
      return;
    }
    anim.current = { from: shown.current, t0: performance.now() };
    const step = (now: number) => {
      const a = anim.current;
      if (!a) return;
      const p = Math.min(1, (now - a.t0) / DUR);
      const e = 1 - (1 - p) * (1 - p);
      const to = target.current;
      let cur: Decimal;
      if (p >= 1) cur = to;
      else if (a.from.gt(0) && to.gt(a.from.mul(100))) cur = Decimal.pow(10, a.from.log10() + (to.log10() - a.from.log10()) * e);
      else cur = a.from.add(to.sub(a.from).mul(e));
      shown.current = cur;
      setText(formatNumber(cur));
      if (p < 1) raf.current = requestAnimationFrame(step);
      else anim.current = null;
    };
    raf.current = requestAnimationFrame(step);
  }, [value]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return { text, bump };
}
