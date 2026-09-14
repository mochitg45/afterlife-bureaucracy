import { render } from '@testing-library/react';
import { StaffRow } from './StaffRow';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(mood: 'ok' | 'cooked') {
  const state = createInitialState({ wall: 0, mono: 0 }, content);
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, mood });
}

describe('StaffRow', () => {
  it('shows the ok mood from the store', () => {
    seed('ok');
    const { container } = render(<StaffRow staff={content.departments[0].staff[0]} mode={1} />);
    expect(container.querySelector('[data-character]')).toHaveAttribute('data-mood', 'ok');
  });

  it('shows the cooked mood from the store', () => {
    seed('cooked');
    const { container } = render(<StaffRow staff={content.departments[0].staff[0]} mode={1} />);
    expect(container.querySelector('[data-character]')).toHaveAttribute('data-mood', 'cooked');
  });
});
