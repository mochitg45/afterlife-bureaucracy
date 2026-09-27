import { useGame } from '../../store/game';
import { Character } from '../characters/Character';
import { soulFaceUrl } from './soulFace';

export function QueueCard() {
  const line = useGame((s) => s.queueLine);
  const face = soulFaceUrl(line);
  return (
    <div className="card queue-card">
      {face
        ? <img key={face} className="soul-face" src={face} width={56} height={56} alt="" />
        : <Character id="soul" mood="ok" size={44} />}
      <div>
        <div className="label">Now serving</div>
        <div className="queue-line">{line}</div>
      </div>
    </div>
  );
}
