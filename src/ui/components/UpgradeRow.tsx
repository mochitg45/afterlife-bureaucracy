import { useGame } from '../../store/game';
import type { UpgradeDef } from '../../engine/content';
import { upgradeCost, canAfford } from '../../engine/economy';
import { formatNumber } from '../../engine/format';

export function UpgradeRow({ upgrade }: { upgrade: UpgradeDef }) {
  const level = useGame((s) => s.state.upgrades[upgrade.id] ?? 0);
  const kc = useGame((s) => s.state.kc);
  const buy = useGame((s) => s.upgrade);
  const maxed = level >= upgrade.maxLevel;
  const cost = upgradeCost(upgrade, level);
  return (
    <button className="card upgrade-row" disabled={maxed || !canAfford(cost, kc)} onClick={() => buy(upgrade.id)} aria-label={upgrade.name}>
      <div>
        <div className="staff-name">{upgrade.name} <span className="mono owned">{level}/{upgrade.maxLevel}</span></div>
        <div className="sub">{upgrade.desc}</div>
      </div>
      <div className="mono">{maxed ? 'MAX' : formatNumber(cost)}</div>
    </button>
  );
}
