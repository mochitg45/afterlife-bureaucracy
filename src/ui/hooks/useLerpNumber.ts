import Decimal from 'break_infinity.js';
import { useEffect, useRef, useState } from 'react';

// Eases the displayed value toward the true value each frame so counters roll instead of jump.
export function useLerpNumber(target: Decimal, speed = 0.25): Decimal {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const cur = shownRef.current;
      const tgt = targetRef.current;
      const diff = tgt.sub(cur);
      const next = diff.abs().lt(1) || tgt.lt(cur) ? tgt : cur.add(diff.mul(speed));
      if (!next.eq(cur)) { shownRef.current = next; setShown(next); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed]);
  return shown;
}
