import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { useRolling } from '../hooks/useRolling';
import { KarmaIcon } from '../icons/Currency';

export function CurrencyBar({ onSettings }: { onSettings?: () => void }) {
  const kc = useGame((s) => s.state.kc);
  const souls = useGame((s) => s.state.soulsLifetime);
  const rate = useGame((s) => s.rates.soulsPerSec);
  const year = useGame((s) => s.state.fiscalYear);
  const kcShown = useRolling(kc);
  const soulsShown = useRolling(souls);
  return (
    <header className="currency-bar card">
      {onSettings && (
        <button className="btn btn-ghost gear-btn" aria-label={t('screen.settings')} onClick={onSettings}>⚙</button>
      )}
      <div>
        <div className="label">{t('currency.karma')}</div>
        <div className={`mono value brass amt${kcShown.bump ? ' bump' : ''}`}>{kcShown.text} <KarmaIcon size={20} /></div>
      </div>
      <div>
        <div className="label">{t('currency.souls')}</div>
        <div className={`mono value${soulsShown.bump ? ' bump' : ''}`}>{soulsShown.text}</div>
        <div className="mono sub">{t('currency.rate', { rate: formatNumber(rate), year })}</div>
      </div>
    </header>
  );
}
