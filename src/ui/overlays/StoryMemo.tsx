import { useGame } from '../../store/game';
import { Modal } from '../components/Modal';

/** A "Special Elite" typewriter memo for a story beat the player just triggered. */
export function StoryMemo() {
  const pendingStory = useGame((s) => s.pendingStory);
  const dismissStory = useGame((s) => s.dismissStory);
  const memo = pendingStory[0];
  if (!memo) return null;
  return (
    <Modal open title={memo.title} label="Memo" className="memo" backdropClassName="story">
      <p>{memo.text}</p>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={dismissStory}>Filed</button>
      </div>
    </Modal>
  );
}
