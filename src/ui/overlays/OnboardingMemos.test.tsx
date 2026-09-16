import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingMemos } from './OnboardingMemos';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(memosSeen: boolean) {
  const state = createInitialState({ wall: 0, mono: 0 }, content);
  state.onboarding = { memosSeen, trainingStep: 0 };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true });
}

const [first, second] = content.onboarding.memos;

describe('OnboardingMemos', () => {
  it('renders nothing once the memos have been seen', () => {
    seed(true);
    const { container } = render(<OnboardingMemos />);
    expect(container).toBeEmptyDOMElement();
  });

  it('walks memo one then memo two, then marks the memos seen', () => {
    seed(false);
    render(<OnboardingMemos />);
    expect(screen.getByText(first.title)).toBeInTheDocument();
    expect(screen.getByText(first.text)).toBeInTheDocument();
    expect(screen.getByText(first.form)).toBeInTheDocument();
    expect(screen.queryByText(second.title)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: first.cta }));
    expect(screen.getByText(second.title)).toBeInTheDocument();
    expect(screen.getByText(second.text)).toBeInTheDocument();
    expect(useGame.getState().state.onboarding.memosSeen).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: second.cta }));
    expect(useGame.getState().state.onboarding.memosSeen).toBe(true);
  });

  it('marks the memos seen immediately when the first one is skipped', () => {
    seed(false);
    render(<OnboardingMemos />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(useGame.getState().state.onboarding.memosSeen).toBe(true);
  });

  it('marks the memos seen when the second one is skipped', () => {
    seed(false);
    render(<OnboardingMemos />);
    fireEvent.click(screen.getByRole('button', { name: first.cta }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(useGame.getState().state.onboarding.memosSeen).toBe(true);
  });

  it('names the dialog by the form number and draws the memo character', () => {
    seed(false);
    const { container } = render(<OnboardingMemos />);
    expect(screen.getByRole('dialog', { name: first.form })).toBeInTheDocument();
    expect(container.querySelector(`[data-character="${first.character}"]`)).toBeInTheDocument();
  });
});
