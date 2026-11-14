import { Modal } from '../components/Modal';
import { t } from '../../i18n';
import { track } from '../../platform/analytics';
import './MoreGamesSheet.css';

/** Our other live Play apps, games first; Smile and CUCO are not games so they go last. */
export const MORE_GAMES = [
  { id: 'cloverhop', name: 'Clover Hop', pkg: 'com.inatasunsoft.cloverhop' },
  { id: 'groupsnap', name: 'Group Snap', pkg: 'com.inatasunsoft.groupsnap' },
  { id: 'peekapop', name: 'Peek-a-Pop', pkg: 'com.inatasunsoft.peekapop' },
  { id: 'tidedocks', name: 'Tide Docks', pkg: 'com.inatasunsoft.tidedocks' },
  { id: 'sunpane', name: 'Sunpane', pkg: 'com.inatasunsoft.sunpane' },
  { id: 'decant', name: 'Decant', pkg: 'com.sortlab.watersortpuzzle' },
  { id: 'topplejam', name: 'Topple Jam', pkg: 'com.inatasunsoft.topplejam' },
  { id: 'echodeep', name: 'Echo Deep', pkg: 'com.inatasunsoft.echodeep' },
  { id: 'sandmanco', name: 'Sandman & Co.', pkg: 'com.inatasunsoft.sandmanco' },
  { id: 'cuco', name: 'CUCO', pkg: 'com.cuco.converter' },
  { id: 'smile', name: 'Smile', pkg: 'com.smileapp.mentalhealth' },
] as const;

/** The https Play link: Android hands it to the Play Store app, so no market:// fallback is needed. */
export const playLink = (pkg: string) =>
  `https://play.google.com/store/apps/details?id=${pkg}&referrer=utm_source%3Dafterlife%26utm_medium%3Dmore_games`;

const ICON = (id: string) => `${import.meta.env.BASE_URL}art/more-games/${id}.webp`;

/** "More games": plain links to our other apps. Never a reward, never a pop-up. */
export function MoreGamesSheet({ onClose }: { onClose: () => void }) {
  return (
    <Modal open title={t('moreGames.title')} className="more-games" onClose={onClose}>
      <ul className="more-games-list">
        {MORE_GAMES.map((g) => (
          <li key={g.id} className="more-game">
            <img src={ICON(g.id)} alt="" width={48} height={48} loading="lazy" />
            <div className="more-game-text">
              <strong>{g.name}</strong>
              <span className="sub">{t(`moreGames.pitch.${g.id}`)}</span>
            </div>
            <a className="btn btn-primary more-game-get" href={playLink(g.pkg)} target="_blank" rel="noreferrer"
              aria-label={t('moreGames.getAria', { name: g.name })} onClick={() => track('more_games_click', { target: g.pkg })}>
              {t('moreGames.get')}
            </a>
          </li>
        ))}
      </ul>
      <button className="btn btn-ghost" onClick={onClose}>{t('moreGames.close')}</button>
    </Modal>
  );
}
