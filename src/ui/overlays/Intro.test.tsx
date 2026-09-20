import { render, screen, fireEvent, act } from '@testing-library/react';
import { Intro } from './Intro';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(memosSeen: boolean) {
  const state = createInitialState({ wall: 0, mono: 0 }, content);
  state.onboarding = { memosSeen, trainingStep: 0 };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true });
}

const scenes = content.onboarding.intro;
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));
/** jsdom runs no animations, so the pacer's end has to be fired by hand. */
const pace = () => fireEvent.animationEnd(screen.getByTestId('intro-timer'));

describe('Intro', () => {
  it('renders nothing once the intro has been seen', () => {
    seed(true);
    const { container } = render(<Intro />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens on scene one: the notice of decease and the rising soul', () => {
    seed(false);
    const { container } = render(<Intro />);
    expect(screen.getByText('FORM 1-A · NOTICE OF DECEASE')).toBeInTheDocument();
    expect(screen.getByText(/You have died/)).toBeInTheDocument();
    expect(container.querySelector('.intro-rise [data-character="soul"]')).toBeInTheDocument();
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

  it('auto-advances when a scene is left alone, up to the last one', () => {
    seed(false);
    render(<Intro />);
    pace();
    expect(screen.getByText(/forwarded to Intake/)).toBeInTheDocument();
    pace();
    pace();
    expect(screen.getByRole('button', { name: 'Clock in' })).toBeInTheDocument();
    expect(useGame.getState().state.onboarding.memosSeen).toBe(false);
  });

  it('never self-dismisses on the last scene: the pacer is not mounted there', () => {
    seed(false);
    render(<Intro />);
    next();
    next();
    next();
    expect(screen.queryByTestId('intro-timer')).not.toBeInTheDocument();
    expect(useGame.getState().state.onboarding.memosSeen).toBe(false);
  });

  it('advances one scene per tap, on the button or the stage', () => {
    seed(false);
    render(<Intro />);
    fireEvent.click(screen.getByRole('dialog'));
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
