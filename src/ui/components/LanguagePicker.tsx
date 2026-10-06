import { LANGS, getLang, isLang, setLang, t } from '../../i18n';
import { useGame } from '../../store/game';

/**
 * Every language listed in its own name, so a player who lands in the wrong one can still
 * find theirs. Switching saves the desk first, then reloads so content and UI rebuild in it.
 */
export function LanguagePicker({ className = 'lang-select' }: { className?: string }) {
  const onChange = async (l: string) => {
    if (!isLang(l)) return;
    await useGame.getState().save();
    setLang(l);
  };
  return (
    <select className={className} aria-label={t('settings.language')} value={getLang()} onChange={(e) => void onChange(e.target.value)}>
      {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
    </select>
  );
}
