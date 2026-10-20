import { useEffect, useState, type ReactNode } from 'react';
import Decimal from 'break_infinity.js';
import { t } from '../../i18n';
import { formatNumber } from '../../engine/format';
import type { BoardView } from '../../platform/lifetimeBoard';
import { Modal } from './Modal';
import './BoardSheet.css';

/**
 * An in-game leaderboard: the top players with real, formatted numbers (souls or event
 * currency), and this player's own place. Loads on open; `onPlayGames` adds a link to the
 * Play Games board where there is one.
 */
export function BoardSheet({ title, view, load, unit, onClose, onPlayGames, totalText }: {
  title: string;
  view: BoardView | null;
  load: () => Promise<boolean>;
  unit?: ReactNode;
  onClose: () => void;
  onPlayGames?: () => void;
  /** Replaces the "Players: n" line (an alliance board counts alliances or members). */
  totalText?: (total: number) => string;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  useEffect(() => {
    let live = true;
    void load().then((ok) => { if (live) setState(ok ? 'ok' : 'error'); });
    return () => { live = false; };
  }, [load]);
  return (
    <Modal open title={title} className="board-sheet" onClose={onClose}>
      {view && <p className="sub board-total mono">{totalText ? totalText(view.total) : t('board.players', { total: formatNumber(new Decimal(view.total)) })}</p>}
      {view && view.rank !== null && <p className="board-you mono">{t('board.rank', { rank: view.rank, total: view.total })}</p>}
      {view && view.rank === null && state === 'ok' && <p className="sub">{t('board.notRanked')}</p>}
      {!view && state === 'loading' && <p className="sub" role="status">{t('board.loading')}</p>}
      {!view && state === 'error' && <p className="sub warn" role="status">{t('board.error')}</p>}
      {view && (
        <ol className="board-list">
          {view.top.map((r, i) => (
            <li key={i} className={'board-row' + (r.me ? ' me' : '') + (i < 3 ? ` top${i + 1}` : '')}>
              <span className="board-place mono">{i + 1}</span>
              <span className="board-name">{r.name}{r.me && <span className="board-me"> {t('board.you')}</span>}</span>
              <span className="board-value mono amt">{formatNumber(new Decimal(r.souls))} {unit}</span>
            </li>
          ))}
        </ol>
      )}
      {onPlayGames && <button className="btn btn-ghost board-pgs" onClick={onPlayGames}>{t('board.playGames')}</button>}
    </Modal>
  );
}
