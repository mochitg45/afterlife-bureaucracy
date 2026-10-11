import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { EventScreen } from './EventScreen';
import { PullReveal } from '../overlays/PullReveal';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { eventOccurrences, EVENT_UNLOCK_HIRES, type EventOccurrence } from '../../engine/events';
import { content } from '../../data';
import type { PullResult } from '../../engine/gacha';

// Two years of the calendar covers every holiday and every weekly theme at least once.
const FROM = Date.UTC(2026, 0, 1);
const all: EventOccurrence[] = [];
for (const o of eventOccurrences(content, FROM, FROM + 2 * 366 * 86_400_000)) if (!all.some((x) => x.id === o.id)) all.push(o);

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

function seed(occ: EventOccurrence) {
  vi.setSystemTime(occ.startWall + 3_600_000);
  const base = createInitialState({ wall: 0, mono: 0 }, content);
  const cards = Object.fromEntries(content.cards.filter((c) => c.event === occ.id).map((c) => [c.id, 1]));
  const state = {
    ...base,
    cards,
    stats: { ...base.stats, staffHired: EVENT_UNLOCK_HIRES },
    event: { key: occ.key, points: new Decimal(0), earned: new Decimal(0), staff: {}, claimed: [] },
  };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, activeEvent: () => occ, pendingPull: null });
}

const ghosts = (root: ParentNode) => root.querySelectorAll('svg[data-character="soul"]').length;

describe('every event shows real art and labels', () => {
  it('covers all 6 holidays and all 14 weekly themes', () => {
    expect(all.filter((o) => o.kind === 'special')).toHaveLength(content.events.specials.length);
    expect(all.filter((o) => o.kind === 'weekly')).toHaveLength(content.events.weekly!.themes.length);
  });

  it.each(all.map((o) => [o.id, o] as const))('%s: staff, banner and pulled cards have art, no raw ids', (_id, occ) => {
    seed(occ);
    const { container } = render(<EventScreen onBack={() => {}} />);
    expect(ghosts(container)).toBe(0);
    fireEvent.click(screen.getByRole('tab', { name: /gacha/i }));
    expect(ghosts(container)).toBe(0);
    if (occ.kind === 'weekly') expect(container.textContent).not.toContain(occ.id);
    cleanup();

    const results = content.cards.filter((c) => c.event === occ.id).map((c): PullResult => ({
      cardId: c.id, rarity: c.rarity, starsAfter: 1, duplicateKc: null, pityTriggered: null, shards: 0, shardsNeeded: 2, spareGained: false,
    }));
    expect(results).toHaveLength(4);
    useGame.setState({ pendingPull: results });
    const reveal = render(<PullReveal />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(ghosts(reveal.container.ownerDocument)).toBe(0);
    expect(reveal.container.ownerDocument.body.textContent).not.toContain(occ.id + ' ');
  });
});
