import { render, screen, fireEvent } from '@testing-library/react';
import { StoryMemo } from './StoryMemo';
import { useGame, TRAINING_DONE } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';
import type { StoryDef } from '../../engine/content';

function seed(pendingStory: StoryDef[], trainingStep = TRAINING_DONE) {
  const base = createInitialState({ wall: 0, mono: 0 }, content);
  const state = { ...base, onboarding: { ...base.onboarding, trainingStep } };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, pendingStory });
}

describe('StoryMemo', () => {
  it('renders nothing without a pending story', () => {
    seed([]);
    const { container } = render(<StoryMemo />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the memo title and text, and dismisses on Filed', () => {
    const memo = content.story[0];
    seed([memo]);
    render(<StoryMemo />);
    expect(screen.getByRole('dialog', { name: /memo/i })).toBeInTheDocument();
    expect(screen.getByText(memo.title)).toBeInTheDocument();
    expect(screen.getByText(memo.text)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /filed/i }));
    expect(useGame.getState().pendingStory).toEqual([]);
  });

  it('stays queued behind the walkthrough', () => {
    seed([content.story[0]], 0);
    const { container } = render(<StoryMemo />);
    expect(container).toBeEmptyDOMElement();
    // Queued, not dropped: it opens as soon as the walkthrough is behind the player.
    expect(useGame.getState().pendingStory).toHaveLength(1);
  });

  it('shows only the first of several pending memos', () => {
    seed([content.story[0], content.story[1]]);
    render(<StoryMemo />);
    expect(screen.getByText(content.story[0].title)).toBeInTheDocument();
    expect(screen.queryByText(content.story[1].title)).not.toBeInTheDocument();
  });
});
