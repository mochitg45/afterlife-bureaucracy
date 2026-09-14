import { useGame } from '../../store/game';
import { Character } from '../characters/Character';

export function QueueCard() {
  const line = useGame((s) => s.queueLine);
  return (
    <div className="card queue-card">
      <Character id="soul" mood="ok" size={44} />
      <div>
        <div className="label">Now serving</div>
        <div className="queue-line">{line}</div>
      </div>
    </div>
  );
}
