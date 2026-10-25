import { useRef, useState } from 'react';
import { t } from '../../i18n';

export const COMBO_GAP_MS = 600;
export const COMBO_MIN = 5;
export const comboTier = (n: number) => (n >= 50 ? 4 : n >= 25 ? 3 : n >= 10 ? 2 : 1);

/**
 * Taps in a row, shared by the office stamp and the event stamp. `hit()` counts a tap and
 * returns the run length (1 for a lone tap). The combo is cosmetic: it never changes a payout.
 * Pass `visible: false` (reduced motion) to count without showing the label.
 */
export function useCombo() {
  const [combo, setCombo] = useState({ n: 0, done: false });
  const last = useRef({ at: 0, n: 0 });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const hit = (visible = true): number => {
    const now = performance.now();
    const n = now - last.current.at < COMBO_GAP_MS ? last.current.n + 1 : 1;
    last.current = { at: now, n };
    if (visible && n >= COMBO_MIN) setCombo({ n, done: false });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCombo((c) => ({ ...c, done: true })), COMBO_GAP_MS);
    return n;
  };
  return { combo, hit };
}

/** The rising "×N COMBO!" label; render it inside the scene's `.stamp-fx` layer. */
export function ComboLabel({ combo }: { combo: { n: number; done: boolean } }) {
  if (combo.n < COMBO_MIN) return null;
  return <div className={`combo-label t${comboTier(combo.n)}${combo.done ? ' done' : ''}`}><span key={combo.n}>{t('stamp.combo', { n: combo.n })}</span></div>;
}
