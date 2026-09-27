import { render, screen } from '@testing-library/react';
import { StampButton } from './StampButton';
import { useGame } from '../../store/game';
import { createInitialState, type GameState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(patch: Partial<GameState>) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }, content), ...patch };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, lastCosmic: null });
}

describe('StampButton scene', () => {
  it('shows the hell scene for the hell department', () => {
    seed({ activeDept: 'hell' });
    render(<StampButton />);
    const scene = screen.getByTestId('stamp-scene');
    expect(scene.style.backgroundImage).toContain('art/depts/hell.webp');
  });

  it('shows the valhalla scene for the valhalla department', () => {
    seed({ activeDept: 'valhalla' });
    render(<StampButton />);
    const scene = screen.getByTestId('stamp-scene');
    expect(scene.style.backgroundImage).toContain('art/depts/valhalla.webp');
  });

  it('falls back to intake for an unknown department id', () => {
    seed({ activeDept: 'nonexistent' as GameState['activeDept'] });
    render(<StampButton />);
    const scene = screen.getByTestId('stamp-scene');
    expect(scene.style.backgroundImage).toContain('art/depts/intake.webp');
  });
});
