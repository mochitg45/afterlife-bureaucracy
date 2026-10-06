/**
 * Title bar for every screen that has no CurrencyBar of its own. The gear lives here so
 * Settings is one tap away wherever the player happens to be, not only on the Office tab.
 */
import { t } from '../../i18n';

export function ScreenHeader({ title, onSettings }: { title: string; onSettings?: () => void }) {
  return (
    <header className="screen-header">
      <h2>{title}</h2>
      {onSettings && (
        <button className="btn btn-ghost gear-btn" aria-label={t('screen.settings')} onClick={onSettings}>⚙</button>
      )}
    </header>
  );
}
