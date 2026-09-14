import { useEffect } from 'react';
import { useGame } from '../../store/game';

export function MemoTicker() {
  const memo = useGame((s) => s.memoLine);
  const rotate = useGame((s) => s.rotateMemo);
  useEffect(() => {
    const t = setInterval(rotate, 12_000);
    return () => clearInterval(t);
  }, [rotate]);
  return (
    <div className="memo-ticker" role="status" aria-live="polite">
      <span className="memo-text">{memo}</span>
    </div>
  );
}
