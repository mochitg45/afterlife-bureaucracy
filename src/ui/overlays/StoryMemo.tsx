import { useGame } from '../../store/game';

/** A "Special Elite" typewriter memo for a story beat the player just triggered. */
export function StoryMemo() {
  const pendingStory = useGame((s) => s.pendingStory);
  const dismissStory = useGame((s) => s.dismissStory);
  const memo = pendingStory[0];
  if (!memo) return null;
  return (
    <div className="modal-backdrop story">
      <div className="modal card memo" role="dialog" aria-modal="true" aria-label="Memo">
        <h2 className="modal-title">{memo.title}</h2>
        <p>{memo.text}</p>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={dismissStory}>Filed</button>
        </div>
      </div>
    </div>
  );
}
