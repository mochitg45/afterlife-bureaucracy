import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import { Intro } from './Intro';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(memosSeen: boolean) {
  const state = createInitialState({ wall: 0, mono: 0 }, content);
  state.onboarding = { memosSeen, trainingStep: 0, tipsSeen: [] };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true });
}

const scenes = content.onboarding.intro;
// Clicks past the 300ms double-tap guard, so a chain of these walks one scene per call.
const next = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  act(() => { vi.advanceTimersByTime(301); });
};
const tapStage = () => {
  fireEvent.click(screen.getByRole('dialog'));
  act(() => { vi.advanceTimersByTime(301); });
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('Intro', () => {
  it('renders nothing once the intro has been seen', () => {
    seed(true);
    const { container } = render(<Intro />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens on scene one: the notice of decease, painted', () => {
    seed(false);
    const { container } = render(<Intro />);
    expect(screen.getByText('FORM 1-A · NOTICE OF DECEASE')).toBeInTheDocument();
    expect(screen.getByText(/You have died/)).toBeInTheDocument();
    const img = container.querySelector('img.intro-scene-img') as HTMLImageElement | null;
    expect(img?.src).toMatch(/art\/story\/in-decease\.webp$/);
  });

  it('renders each scene id as its own painted background', () => {
    seed(false);
    const { container } = render(<Intro />);
    for (const scene of scenes) {
      const img = container.querySelector('img.intro-scene-img') as HTMLImageElement | null;
      expect(img?.src).toMatch(new RegExp(`art/story/${scene.id}\\.webp$`));
      if (scene !== scenes[scenes.length - 1]) next();
    }
  });

  it('walks Next through all four scenes to the Clock in button', () => {
    seed(false);
    render(<Intro />);
    next();
    expect(screen.getByText(/forwarded to Intake/)).toBeInTheDocument();
    next();
    expect(screen.getByText('FORM 2-C · OFFER OF EMPLOYMENT')).toBeInTheDocument();
    next();
    expect(screen.getByRole('button', { name: scenes[3].cta })).toBeInTheDocument();
    expect(useGame.getState().state.onboarding.memosSeen).toBe(false);
  });

  it('never changes scene on its own, however long the player waits', () => {
    seed(false);
    render(<Intro />);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByText('FORM 1-A · NOTICE OF DECEASE')).toBeInTheDocument();
    expect(screen.getByText(/You have died/)).toBeInTheDocument();
    expect(useGame.getState().state.onboarding.memosSeen).toBe(false);
  });

  it('advances one scene per tap, on the button or the stage', () => {
    seed(false);
    render(<Intro />);
    tapStage();
    expect(screen.getByText(/forwarded to Intake/)).toBeInTheDocument();
    expect(screen.queryByText('FORM 2-C · OFFER OF EMPLOYMENT')).not.toBeInTheDocument();
  });

  it('unmounts cleanly when memosSeen flips mid-intro', () => {
    seed(false);
    const { container } = render(<Intro />);
    next();
    act(() => useGame.getState().markMemosSeen());
    expect(container).toBeEmptyDOMElement();
  });

  it('advances on a tap anywhere on the stage', () => {
    seed(false);
    render(<Intro />);
    fireEvent.click(screen.getByRole('dialog', { name: 'Introduction' }));
    expect(screen.getByText(/forwarded to Intake/)).toBeInTheDocument();
  });

  it('guards against a double tap: one tap moves one scene', () => {
    seed(false);
    render(<Intro />);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    fireEvent.click(dialog); // fired well inside the 300ms guard window, must be ignored
    expect(screen.getByText(/forwarded to Intake/)).toBeInTheDocument();
    expect(screen.queryByText('FORM 2-C · OFFER OF EMPLOYMENT')).not.toBeInTheDocument();
  });

  it('completes the intro on a tap on the last scene', () => {
    seed(false);
    render(<Intro />);
    tapStage();
    tapStage();
    tapStage();
    expect(useGame.getState().state.onboarding.memosSeen).toBe(false);
    tapStage();
    expect(useGame.getState().state.onboarding.memosSeen).toBe(true);
  });

  it('skips from scene two without walking the rest', () => {
    seed(false);
    render(<Intro />);
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(useGame.getState().state.onboarding.memosSeen).toBe(true);
  });

  it('offers Skip on every scene', () => {
    seed(false);
    render(<Intro />);
    for (let i = 0; i < scenes.length; i++) {
      expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
      if (i < scenes.length - 1) next();
    }
  });

  it('ends the intro when Clock in is pressed on the last scene', () => {
    seed(false);
    render(<Intro />);
    next();
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Clock in' }));
    expect(useGame.getState().state.onboarding.memosSeen).toBe(true);
  });
});
