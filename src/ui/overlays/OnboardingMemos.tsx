import { useState } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { Modal } from '../components/Modal';
import { Character } from '../characters/Character';

/**
 * The two memos a new clerk is handed on their first shift: the notice of decease, then the
 * offer of employment. Either finishing the last one or skipping marks them seen, and the
 * flag lives in the save, so a reload does not deliver the post twice.
 */
export function OnboardingMemos() {
  const memosSeen = useGame((s) => s.state.onboarding.memosSeen);
  const markMemosSeen = useGame((s) => s.markMemosSeen);
  const [index, setIndex] = useState(0);
  const memos = content.onboarding.memos;

  if (memosSeen || memos.length === 0) return null;
  // Clamped rather than indexed raw: a content build with fewer memos than a stale index
  // should show the last one, not an empty dialog.
  const memo = memos[Math.min(index, memos.length - 1)];
  const onNext = () => {
    if (index + 1 < memos.length) setIndex(index + 1);
    else markMemosSeen();
  };

  return (
    <Modal
      open
      title={memo.title}
      label={memo.form}
      className="memo onboarding-memo"
      backdropClassName="story"
      header={<div className="mono label ob-form">{memo.form}</div>}
    >
      <div className="ob-art"><Character id={memo.character} mood="ok" size={72} /></div>
      <p>{memo.text}</p>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onNext}>{memo.cta}</button>
        <button className="btn btn-ghost" onClick={markMemosSeen}>Skip</button>
      </div>
    </Modal>
  );
}
