import { useGame } from '../../store/game';
import type { UpgradeDef } from '../../engine/content';
import { upgradeCost, canAfford } from '../../engine/economy';
import { formatNumber } from '../../engine/format';
import { KarmaIcon } from '../icons/Currency';
import { t } from '../../i18n';

/** `first` marks the department's first upgrade as the beginner tip's spotlight target. */
export function UpgradeRow({ upgrade, first = false }: { upgrade: UpgradeDef; first?: boolean }) {
  const level = useGame((s) => s.state.upgrades[upgrade.id] ?? 0);
  const kc = useGame((s) => s.state.kc);
  const buy = useGame((s) => s.upgrade);
  const maxed = level >= upgrade.maxLevel;
  const cost = upgradeCost(upgrade, level);
  return (
    <button className="card upgrade-row" disabled={maxed || !canAfford(cost, kc)} onClick={() => buy(upgrade.id)} aria-label={upgrade.name} data-goal={`upgrade-${upgrade.id}`} {...(first ? { 'data-coach': 'upgrade' } : {})}>
      <div>
        <div className="staff-name">{upgrade.name} <span className="mono owned">{level}/{upgrade.maxLevel}</span></div>
        <div className="sub">{upgrade.desc}</div>
      </div>
      <div className="mono amt">{maxed ? t('upgrade.max') : <>{formatNumber(cost)} <KarmaIcon size={14} /></>}</div>
    </button>
  );
}
