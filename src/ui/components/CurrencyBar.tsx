import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { useLerpNumber } from '../hooks/useLerpNumber';

export function CurrencyBar({ onSettings }: { onSettings?: () => void }) {
  const kc = useGame((s) => s.state.kc);
  const souls = useGame((s) => s.state.soulsLifetime);
  const rate = useGame((s) => s.rates.soulsPerSec);
  const year = useGame((s) => s.state.fiscalYear);
  const kcShown = useLerpNumber(kc);
  const soulsShown = useLerpNumber(souls);
  return (
    <header className="currency-bar card">
      {onSettings && (
        <button className="btn btn-ghost gear-btn" aria-label="Settings" onClick={onSettings}>⚙</button>
      )}
      <div>
        <div className="label">Karma Credits</div>
        <div className="mono value brass">{formatNumber(kcShown)}</div>
      </div>
      <div>
        <div className="label">Souls Processed</div>
        <div className="mono value">{formatNumber(soulsShown)}</div>
        <div className="mono sub">{formatNumber(rate)}/s · FY {year}</div>
      </div>
    </header>
  );
}
