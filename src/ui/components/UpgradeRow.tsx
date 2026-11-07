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
  const firstBuy = useGame((s) => first && s.state.stats.upgradesBought === 0);
  const maxed = level >= upgrade.maxLevel;
  const cost = upgradeCost(upgrade, level);
  const ready = !maxed && canAfford(cost, kc);
  return (
    <button className={'card upgrade-row' + (firstBuy && ready ? ' first-buy' : '')} disabled={!ready} onClick={() => buy(upgrade.id)} aria-label={upgrade.name} data-goal={`upgrade-${upgrade.id}`} {...(first ? { 'data-coach': 'upgrade' } : {})}>
      <div>
        <div className="staff-name">{upgrade.name} <span className="mono owned">{level}/{upgrade.maxLevel}</span></div>
        <div className="sub">{upgrade.desc}</div>
      </div>
      <div className="mono amt">{maxed ? t('upgrade.max') : <>{formatNumber(cost)} <KarmaIcon size={14} /></>}</div>
    </button>
  );
}
