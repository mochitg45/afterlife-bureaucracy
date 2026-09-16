import { useGame, TRAINING_DONE } from '../../store/game';
import { content } from '../../data';
import { CoachMark } from '../components/CoachMark';

/**
 * The three-step walkthrough that follows the memos. Steps 0 and 1 are advanced by the store
 * when the player actually stamps and actually hires, so the coach mark never asks for a tap
 * it then swallows; the recap has nothing to point at and ends on its own button.
 */
export function Training() {
  const memosSeen = useGame((s) => s.state.onboarding.memosSeen);
  const step = useGame((s) => s.state.onboarding.trainingStep);
  const advanceTraining = useGame((s) => s.advanceTraining);
  const skipTraining = useGame((s) => s.skipTraining);

  if (!memosSeen || step >= TRAINING_DONE) return null;
  const def = content.onboarding.training.find((t) => t.step === step);
  if (!def) return null;

  return (
    <CoachMark
      target={def.target}
      title={def.title}
      text={def.text}
      stepIndex={step}
      total={TRAINING_DONE}
      onSkip={skipTraining}
    >
      {step === TRAINING_DONE - 1 && (
        <button className="btn btn-primary" onClick={() => advanceTraining(TRAINING_DONE)}>Got it</button>
      )}
    </CoachMark>
  );
}
