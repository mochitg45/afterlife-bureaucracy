import { render, screen, fireEvent, act } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { PullReveal } from './PullReveal';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';
import type { PullResult } from '../../engine/gacha';

function seed(pendingPull: PullResult[] | null) {
  const state = createInitialState({ wall: 0, mono: 0 }, content);
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, pendingPull });
}

describe('PullReveal', () => {
  it('renders nothing when there is no pending pull', () => {
    seed(null);
    const { container } = render(<PullReveal />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows NEW, duplicate KC, foil executives and guaranteed pity, and dismisses on Done', () => {
    seed([
      { cardId: 'c-dave-overtime', rarity: 'temp', starsAfter: 1, duplicateKc: null, pityTriggered: null, shards: 0, shardsNeeded: 2, spareGained: false },
      { cardId: 'c-keeper', rarity: 'executive', starsAfter: 5, duplicateKc: new Decimal(6000), pityTriggered: 'executive', shards: 0, shardsNeeded: 0, spareGained: false },
      { cardId: 'c-seraph-board', rarity: 'executive', starsAfter: 5, duplicateKc: null, pityTriggered: null, shards: 0, shardsNeeded: 0, spareGained: true },
    ]);
    render(<PullReveal />);
    const dialog = screen.getByRole('dialog', { name: /requisition results/i });
    expect(screen.getByText('NEW')).toBeInTheDocument();
    // The duplicate payout shows the Karma icon and keeps "KC" for screen readers.
    const kcLabel = screen.getByText(/\+6,000/);
    expect(kcLabel).toHaveTextContent('+6,000 KC');
    expect(kcLabel.querySelector('svg[data-icon="karma"]')).toBeInTheDocument();
    expect(screen.getByText('+1 spare copy')).toBeInTheDocument();
    expect(screen.getByText('Guaranteed')).toBeInTheDocument();
    expect(dialog.querySelector('.foil')).toBeInTheDocument();

    // The first tap only fast-forwards the reveal; the second one dismisses.
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }));
    expect(useGame.getState().pendingPull).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }));
    expect(useGame.getState().pendingPull).toBeNull();
  });

  function tenPull(): PullResult[] {
    return content.cards.slice(0, 10).map((card): PullResult => ({
      cardId: card.id,
      rarity: card.rarity,
      starsAfter: 1,
      duplicateKc: null,
      pityTriggered: null,
      shards: 0,
      shardsNeeded: 2,
      spareGained: false,
    }));
  }

  describe('reveal animation', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('plays, thunks the stamp once, and settles on its own without leaking timers', () => {
      seed(tenPull());
      const play = vi.spyOn(useGame.getState().audio, 'play');
      const { unmount } = render(<PullReveal />);
      const dialog = screen.getByRole('dialog', { name: /requisition results/i });
      expect(dialog).toHaveClass('reveal-motion');
      expect(dialog.querySelector('.reveal-intro')).toBeInTheDocument();
      expect(dialog.querySelectorAll('.reveal-cell')).toHaveLength(10);
      expect(screen.getAllByText('NEW')).toHaveLength(10);

      act(() => { vi.advanceTimersByTime(400); });
      expect(play).toHaveBeenCalledWith('stamp');
      act(() => { vi.advanceTimersByTime(5000); });
      expect(dialog).not.toHaveClass('reveal-motion');
      expect(dialog.querySelector('.reveal-intro')).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
      expect(play.mock.calls.filter(([n]) => n === 'stamp')).toHaveLength(1);
      unmount();
      play.mockRestore();
    });

    it('waits for the game to be on screen (behind a rewarded ad) before playing', () => {
      seed(tenPull());
      const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      render(<PullReveal />);
      const dialog = screen.getByRole('dialog', { name: /requisition results/i });
      act(() => { vi.advanceTimersByTime(5000); });
      expect(dialog).toHaveClass('reveal-waiting');
      expect(dialog.querySelector('.reveal-intro')).toBeNull();
      vis.mockReturnValue('visible');
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      expect(dialog).toHaveClass('reveal-motion');
      expect(dialog.querySelector('.reveal-intro')).toBeInTheDocument();
      vis.mockRestore();
    });

    it('fast-forwards to the final state on a tap and cancels pending timers', () => {
      seed(tenPull());
      const play = vi.spyOn(useGame.getState().audio, 'play');
      render(<PullReveal />);
      const dialog = screen.getByRole('dialog', { name: /requisition results/i });
      // The reveal owns four timers (settle, stamp thunk, rarity sting, spotlight off); the skip cancels all.
      const pending = vi.getTimerCount();
      fireEvent.click(dialog);
      expect(dialog).not.toHaveClass('reveal-motion');
      expect(dialog.querySelector('.reveal-intro')).toBeNull();
      expect(dialog.querySelectorAll('.reveal-cell')).toHaveLength(10);
      expect(vi.getTimerCount()).toBe(pending - 4);
      expect(document.querySelector('.spot')).toBeNull();
      // Skipped before the slam, so no stamp sound after the fact.
      act(() => { vi.advanceTimersByTime(3000); });
      expect(play).not.toHaveBeenCalledWith('stamp');
      // Once settled, taps reach the UI again.
      fireEvent.click(screen.getByRole('button', { name: /^done$/i }));
      expect(useGame.getState().pendingPull).toBeNull();
      play.mockRestore();
    });

    it('spotlights the rarest card in its rarity colour and plays its sting on the flip', () => {
      const pull = tenPull();
      pull[6] = { ...pull[6], cardId: 'c-keeper', rarity: 'executive' };
      seed(pull);
      const play = vi.spyOn(useGame.getState().audio, 'play');
      render(<PullReveal />);
      const spot = document.querySelector('.spot');
      expect(spot).toHaveClass('spot-executive');
      expect(spot).toHaveTextContent('Executive');
      act(() => { vi.advanceTimersByTime(1500); });
      expect(play).not.toHaveBeenCalledWith('reveal-executive');
      act(() => { vi.advanceTimersByTime(800); }); // build ends at 560 + 1300 = 1860ms, flip turns ~180ms later
      expect(play).toHaveBeenCalledWith('reveal-executive');
      act(() => { vi.advanceTimersByTime(1400); });
      expect(document.querySelector('.spot')).toBeNull();
      act(() => { vi.advanceTimersByTime(3000); });
      expect(play.mock.calls.filter(([n]) => n === 'reveal-executive')).toHaveLength(1);
      play.mockRestore();
    });

    it('still plays the sting once when the reveal is skipped before the flip', () => {
      seed(tenPull());
      const play = vi.spyOn(useGame.getState().audio, 'play');
      render(<PullReveal />);
      fireEvent.click(screen.getByRole('dialog', { name: /requisition results/i }));
      act(() => { vi.advanceTimersByTime(5000); });
      expect(play.mock.calls.filter(([n]) => String(n).startsWith('reveal-'))).toHaveLength(1);
      play.mockRestore();
    });

    it('unmounting mid-animation leaves no timers behind', () => {
      seed(tenPull());
      const { unmount } = render(<PullReveal />);
      act(() => { vi.advanceTimersByTime(100); });
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('under reduced motion skips the slam and just fades the results in', () => {
      const mm = vi.fn().mockReturnValue({ matches: true });
      vi.stubGlobal('matchMedia', mm);
      seed(tenPull());
      const play = vi.spyOn(useGame.getState().audio, 'play');
      render(<PullReveal />);
      const dialog = screen.getByRole('dialog', { name: /requisition results/i });
      expect(dialog).toHaveClass('reveal-fade');
      expect(dialog).not.toHaveClass('reveal-motion');
      expect(dialog.querySelector('.reveal-intro')).toBeNull();
      act(() => { vi.advanceTimersByTime(1000); });
      expect(dialog).not.toHaveClass('reveal-fade');
      expect(play).not.toHaveBeenCalledWith('stamp');
      expect(vi.getTimerCount()).toBe(0);
      play.mockRestore();
      vi.unstubAllGlobals();
    });
  });

  it('renders a 2-column grid of 10 cells for a ten-pull', () => {
    const ids = content.cards.slice(0, 10).map((c) => c.id);
    seed(
      ids.map((cardId, i): PullResult => ({
        cardId,
        rarity: content.cards[i].rarity,
        starsAfter: 1,
        duplicateKc: null,
        pityTriggered: null,
        shards: 0,
        shardsNeeded: 2,
        spareGained: false,
      })),
    );
    render(<PullReveal />);
    const dialog = screen.getByRole('dialog', { name: /requisition results/i });
    expect(dialog.querySelectorAll('.reveal-cell')).toHaveLength(10);
    expect(dialog.querySelector('.reveal-grid')).toBeInTheDocument();
  });

  it('labels a same-pull duplicate that banked a shard as progress, not NEW', () => {
    seed([
      { cardId: 'c-dave-overtime', rarity: 'temp', starsAfter: 1, duplicateKc: null, pityTriggered: null, shards: 0, shardsNeeded: 2, spareGained: false },
      { cardId: 'c-dave-overtime', rarity: 'temp', starsAfter: 1, duplicateKc: null, pityTriggered: null, shards: 1, shardsNeeded: 2, spareGained: false },
    ]);
    render(<PullReveal />);
    expect(screen.getAllByText('NEW')).toHaveLength(1);
    expect(screen.getByText('+1 (1/2)')).toBeInTheDocument();
  });
});
