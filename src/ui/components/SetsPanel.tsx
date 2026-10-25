import { useGame } from '../../store/game';
import { content } from '../../data';
import type { SetDef } from '../../engine/content';
import { setProgress } from '../../engine/sets';
import { Character } from '../characters/Character';
import { t } from '../../i18n';
import './SetsPanel.css';

/** Player-facing bonus line, e.g. "+5% souls in Heaven". */
export function setBonusText(set: SetDef): string {
  const n = Math.round(set.bonus.value * 100);
  if (set.bonus.type === 'souls') {
    const dept = set.bonus.dept ? content.departments.find((d) => d.id === set.bonus.dept)?.name : undefined;
    return dept ? t('set.bonus.soulsDept', { n, dept }) : t('set.bonus.souls', { n });
  }
  return t(`set.bonus.${set.bonus.type}`, { n });
}

export const setName = (id: string): string => t(`set.name.${id}`);

/** Collection goals: each set shows its cards (silhouettes until owned), progress and bonus. */
export function SetsPanel() {
  const cards = useGame((s) => s.state.cards);
  return (
    <div className="sets-panel">
      <p className="sub">{t('set.intro')}</p>
      {content.sets.map((set) => {
        const { have, total } = setProgress({ cards }, set);
        const done = have === total;
        return (
          <div key={set.id} className={'card set-card' + (done ? ' complete' : '')}>
            <div className="set-head">
              <h3>{setName(set.id)}</h3>
              <span className="mono set-count">{have}/{total}</span>
            </div>
            <div className="set-thumbs">
              {set.cards.map((id) => {
                const def = content.cards.find((c) => c.id === id)!;
                const owned = id in cards;
                return (
                  <span key={id} className={'set-thumb' + (owned ? ' owned' : ' missing')}>
                    <Character id={owned ? def.character : 'soul'} art={owned ? def.id : undefined} mood="ok" size={40} />
                    <span className="visually-hidden">{owned ? def.name : t('set.missing')}</span>
                  </span>
                );
              })}
            </div>
            <div className="set-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={have} aria-label={setName(set.id)}>
              <span style={{ width: `${(have / total) * 100}%` }} />
            </div>
            <p className={'set-bonus' + (done ? ' on' : '')}>
              {done ? '✓ ' : ''}{setBonusText(set)}{done ? ` · ${t('set.active')}` : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}
