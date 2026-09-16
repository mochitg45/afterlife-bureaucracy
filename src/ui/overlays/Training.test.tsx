import { render, screen, fireEvent } from '@testing-library/react';
import { Training } from './Training';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(memosSeen: boolean, trainingStep: number) {
  const state = createInitialState({ wall: 0, mono: 0 }, content);
  state.onboarding = { memosSeen, trainingStep };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true });
}

function stampTarget() {
  const button = document.createElement('button');
  button.setAttribute('data-coach', 'stamp');
  button.getBoundingClientRect = () => ({ x: 0, y: 0, width: 120, height: 120, top: 200, left: 30, right: 150, bottom: 320, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(button);
}

const [stampStep, hireStep, recapStep] = content.onboarding.training;

describe('Training', () => {
  afterEach(() => {
    document.querySelectorAll('[data-coach]').forEach((el) => el.remove());
  });

  it('stays hidden until the memos have been read', () => {
    seed(false, 0);
    const { container } = render(<Training />);
    expect(container).toBeEmptyDOMElement();
  });

  it('spotlights the stamp button on step 0', () => {
    stampTarget();
    seed(true, 0);
    const { container } = render(<Training />);
    expect(screen.getByText(stampStep.title)).toBeInTheDocument();
    expect(screen.getByText(stampStep.text)).toBeInTheDocument();
    const hole = container.querySelector('.coach-hole') as HTMLElement;
    expect(hole).not.toBeNull();
    expect(hole.style.left).toBe('30px');
  });

  it('shows the hire copy on step 1', () => {
    seed(true, 1);
    render(<Training />);
    expect(screen.getByText(hireStep.title)).toBeInTheDocument();
    expect(screen.getByText(hireStep.text)).toBeInTheDocument();
  });

  it('ends the walkthrough from the recap step', () => {
    seed(true, 2);
    render(<Training />);
    expect(screen.getByText(recapStep.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(useGame.getState().state.onboarding.trainingStep).toBe(3);
  });

  it('has no Got it button before the recap step', () => {
    seed(true, 0);
    render(<Training />);
    expect(screen.queryByRole('button', { name: 'Got it' })).not.toBeInTheDocument();
  });

  it.each([0, 1, 2])('skips the whole walkthrough from Skip on step %i', (step) => {
    seed(true, step);
    render(<Training />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(useGame.getState().state.onboarding.trainingStep).toBe(3);
  });

  it('disappears once training is done', () => {
    seed(true, 3);
    const { container } = render(<Training />);
    expect(container).toBeEmptyDOMElement();
  });
});
