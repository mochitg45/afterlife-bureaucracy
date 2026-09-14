import { useGame } from '../../store/game';
import { content } from '../../data';
import { findCard } from '../../engine/content';
import { formatNumber } from '../../engine/format';
import type { PullResult } from '../../engine/gacha';
import { CardTile } from '../components/CardTile';

/** New card (first copy) vs. a star-up vs. a duplicate converted to Karma Coins. */
function resultLabel(r: PullResult): string {
  if (r.duplicateKc) return `+${formatNumber(r.duplicateKc)} KC`;
  if (r.starsAfter === 1) return 'NEW';
  return `★ ${r.starsAfter}`;
}

export function PullReveal() {
  const pendingPull = useGame((s) => s.pendingPull);
  const equipped = useGame((s) => s.state.equipped);
  const dismissPull = useGame((s) => s.dismissPull);
  if (!pendingPull) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal card reveal" role="dialog" aria-modal="true" aria-label="Requisition results">
        <h2 className="modal-title">Requisition results</h2>
        <div className="reveal-list">
          {pendingPull.map((r, i) => (
            <div key={i} className={'reveal-row' + (r.rarity === 'executive' ? ' foil' : '')}>
              <CardTile card={findCard(content, r.cardId)} stars={r.starsAfter} owned equipped={equipped.includes(r.cardId)} />
              <span className="mono">{resultLabel(r)}</span>
              {r.pityTriggered && <span className="sub brass">Guaranteed</span>}
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={dismissPull}>Back to Personnel</button>
        </div>
      </div>
    </div>
  );
}
