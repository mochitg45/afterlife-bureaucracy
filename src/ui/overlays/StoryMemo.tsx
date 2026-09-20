import { useGame, TRAINING_DONE } from '../../store/game';
import { Modal } from '../components/Modal';

/** A "Special Elite" typewriter memo for a story beat the player just triggered. */
export function StoryMemo() {
  const pendingStory = useGame((s) => s.pendingStory);
  const trainingStep = useGame((s) => s.state.onboarding.trainingStep);
  const dismissStory = useGame((s) => s.dismissStory);
  const memo = pendingStory[0];
  if (!memo) return null;
  // The first stamp is both the first training step and the first story beat, and a memo
  // over the coach mark would cover the button the coach mark is pointing at. The queue
  // keeps it; it opens as soon as the walkthrough is behind the player.
  if (trainingStep < TRAINING_DONE) return null;
  return (
    <Modal open title={memo.title} label="Memo" className="memo" backdropClassName="story">
      <p>{memo.text}</p>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={dismissStory}>Filed</button>
      </div>
    </Modal>
  );
}
