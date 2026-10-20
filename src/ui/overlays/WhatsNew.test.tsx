import { render, screen, fireEvent } from '@testing-library/react';
import { WhatsNew } from './WhatsNew';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';
import { APP_VERSION } from '../../version';

function seed(trainingStep: number) {
  const state = createInitialState({ wall: 0, mono: 0 }, content);
  state.onboarding = { memosSeen: true, trainingStep, tipsSeen: [] };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true });
}

describe('WhatsNew', () => {
  beforeEach(() => localStorage.clear());

  it('pops once per version for a returning player', () => {
    seed(3);
    const { unmount } = render(<WhatsNew />);
    expect(screen.getByRole('dialog', { name: new RegExp(APP_VERSION.replace(/\./g, '\.')) })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    render(<WhatsNew />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('skips a brand-new player and records the version', () => {
    seed(0);
    render(<WhatsNew />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem('whatsNewSeen')).toBe(APP_VERSION);
  });
});
