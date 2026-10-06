import { render, screen, fireEvent } from '@testing-library/react';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { content } from '../../data';
import { InviteSheet } from './InviteSheet';

describe('InviteSheet', () => {
  it('shows the code and once-only reward, enables reached tiers and pays a claim', () => {
    // refreshReferral is a no-op here (web has no referral backend), so the store is seeded directly.
    useGame.setState({
      state: createInitialState({ wall: 1, mono: 0 }, content),
      referralInfo: { available: true, status: 'ready', code: 'ABCD2345', joined: 3 },
    });
    render(<InviteSheet open onClose={() => {}} />);
    expect(screen.getByText('ABCD2345')).toBeTruthy();
    expect(screen.getByText(/\+10/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Claim 3 friends reward' }));
    expect(useGame.getState().state.vouchers).toBe(40);
    expect(screen.getByRole('button', { name: 'Claim 5 friends reward' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Claimed')).toBeTruthy();
  });

  it('says the office could not be reached', () => {
    useGame.setState({ referralInfo: { available: true, status: 'error', code: null, joined: 0 } });
    render(<InviteSheet open onClose={() => {}} />);
    expect(screen.getByText(/Couldn't reach the referral office/)).toBeTruthy();
  });
});
