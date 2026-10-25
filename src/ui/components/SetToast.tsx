import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { completedSets } from '../../engine/sets';
import { track } from '../../platform/analytics';
import { setBonusText, setName } from './SetsPanel';
import { t } from '../../i18n';

const TOAST_MS = 4500;

/** "Set complete" banner. Watches the owned cards, so every way of getting a card counts. */
export function SetToast() {
  const ready = useGame((s) => s.ready);
  const cards = useGame((s) => s.state.cards);
  const held = useGame((s) => s.pendingPull !== null);
  const seen = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<string[]>([]);

  useEffect(() => {
    if (!ready) return;
    const now = completedSets({ cards }, content).map((s) => s.id);
    // The first look after load only records what was already complete.
    if (seen.current) {
      const fresh = now.filter((id) => !seen.current!.has(id));
      if (fresh.length) {
        for (const id of fresh) track('set_complete', { set_id: id });
        setQueue((q) => [...q, ...fresh]);
      }
    }
    seen.current = new Set(now);
  }, [ready, cards]);

  const id = queue[0];
  useEffect(() => {
    if (!id || held) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), TOAST_MS);
    return () => clearTimeout(timer);
  }, [id, held]);

  if (!id || held) return null;
  const set = content.sets.find((s) => s.id === id)!;
  return (
    <button className="toast ach-toast set-toast" role="status" onClick={() => setQueue((q) => q.slice(1))}>
      <span className="set-star" aria-hidden="true">★</span>
      <span className="ach-body">
        <span className="ach-label">{t('set.complete')}</span>
        <span className="toast-name">{setName(id)}</span>
        <span className="ach-desc">{setBonusText(set)}</span>
      </span>
    </button>
  );
}
