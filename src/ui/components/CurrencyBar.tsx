import { t } from '../../i18n';
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { useLerpNumber } from '../hooks/useLerpNumber';
import { KarmaIcon } from '../icons/Currency';

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
        <button className="btn btn-ghost gear-btn" aria-label={t('screen.settings')} onClick={onSettings}>⚙</button>
      )}
      <div>
        <div className="label">{t('currency.karma')}</div>
        <div className="mono value brass amt">{formatNumber(kcShown)} <KarmaIcon size={20} /></div>
      </div>
      <div>
        <div className="label">{t('currency.souls')}</div>
        <div className="mono value">{formatNumber(soulsShown)}</div>
        <div className="mono sub">{t('currency.rate', { rate: formatNumber(rate), year })}</div>
      </div>
    </header>
  );
}
