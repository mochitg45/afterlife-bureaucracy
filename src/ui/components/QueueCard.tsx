import { useGame } from '../../store/game';
import { Character } from '../characters/Character';
import { soulCard } from './soulFace';
import { t } from '../../i18n';

export function QueueCard() {
  const line = useGame((s) => s.queueLine);
  const { text, faces } = soulCard(line);
  return (
    <div className="card queue-card">
      {faces.length
        ? (
          <div className={'soul-faces' + (faces.length > 1 ? ' twins' : '')} key={line}>
            {faces.map((f, i) => <img key={i} className="soul-face" src={f} width={56} height={56} alt="" />)}
          </div>
        )
        : <Character id="soul" mood="ok" size={44} />}
      <div>
        <div className="label">{t('queue.nowServing')}</div>
        <div className="queue-line">{text}</div>
      </div>
    </div>
  );
}
