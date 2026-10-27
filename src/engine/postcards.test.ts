import Decimal from 'break_infinity.js';
import {
  initialPostcards, sanitizePostcards, tickPostcards, postcardAfterAudit, pickPostcard, openPostcard, postcardSouls,
  POSTCARD_IDS, MAILBOX_CAP, POSTCARD_MIN_MS, POSTCARD_MAX_MS, ALBUM_MILESTONES,
} from './postcards';
import { createInitialState, deserialize, serialize } from './state';
import { content } from '../data';

const H = 3_600_000;
const T0 = 1_700_000_000_000;

describe('postcard catalog', () => {
  it('ships at least 40 uniquely-identified cards', () => {
    expect(POSTCARD_IDS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(POSTCARD_IDS).size).toBe(POSTCARD_IDS.length);
  });
});

describe('tickPostcards', () => {
  it('does nothing before Reincarnation opens or on an untrusted clock', () => {
    const p = initialPostcards();
    expect(tickPostcards(p, T0, false, true)).toBe(p);
    expect(tickPostcards(p, T0, true, false)).toBe(p);
  });

  it('schedules the first card 4-6 hours out, then delivers when due', () => {
    const s = tickPostcards(initialPostcards(), T0, true, true);
    expect(s.nextAtWall - T0).toBeGreaterThanOrEqual(POSTCARD_MIN_MS);
    expect(s.nextAtWall - T0).toBeLessThanOrEqual(POSTCARD_MAX_MS);
    expect(s.waiting).toEqual([]);
    const d = tickPostcards(s, s.nextAtWall, true, true);
    expect(d.waiting).toHaveLength(1);
    expect(d.nextAtWall - s.nextAtWall).toBeGreaterThanOrEqual(POSTCARD_MIN_MS);
  });

  it('a long absence yields one card, not a backlog', () => {
    const s = tickPostcards(initialPostcards(), T0, true, true);
    const d = tickPostcards(s, T0 + 100 * H, true, true);
    expect(d.waiting).toHaveLength(1);
    expect(d.nextAtWall).toBeGreaterThan(T0 + 100 * H);
  });

  it('never exceeds the mailbox cap', () => {
    let p = tickPostcards(initialPostcards(), T0, true, true);
    for (let i = 0; i < 10; i++) p = tickPostcards(p, p.nextAtWall, true, true);
    expect(p.waiting).toHaveLength(MAILBOX_CAP);
    expect(new Set(p.waiting).size).toBe(MAILBOX_CAP);
  });

  it('pulls in a deadline left far ahead by a rewound clock', () => {
    const p = { collected: [], waiting: [], nextAtWall: T0 + 500 * H };
    expect(tickPostcards(p, T0, true, true).nextAtWall).toBe(T0 + POSTCARD_MAX_MS);
  });
});

describe('postcardAfterAudit', () => {
  it('adds one card when there is room and the desk is open', () => {
    expect(postcardAfterAudit(initialPostcards(), T0, true).waiting).toHaveLength(1);
    expect(postcardAfterAudit(initialPostcards(), T0, false).waiting).toHaveLength(0);
    const full = { collected: [], waiting: POSTCARD_IDS.slice(0, MAILBOX_CAP), nextAtWall: 5 };
    expect(postcardAfterAudit(full, T0, true)).toBe(full);
  });
});

describe('pickPostcard', () => {
  it('is deterministic', () => {
    expect(pickPostcard(initialPostcards(), 42)).toBe(pickPostcard(initialPostcards(), 42));
  });

  it('delivers every card once before any repeat, then allows repeats', () => {
    let p = initialPostcards();
    const seen: string[] = [];
    for (let i = 0; i < POSTCARD_IDS.length; i++) {
      const id = pickPostcard(p, i * 7 + 1);
      expect(seen).not.toContain(id);
      seen.push(id);
      p = { ...p, collected: [...p.collected, id] };
    }
    expect(p.collected).toHaveLength(POSTCARD_IDS.length);
    expect(POSTCARD_IDS).toContain(pickPostcard(p, 5));
  });
});

describe('openPostcard', () => {
  it('moves a card from the mailbox to the album and ignores an empty mailbox', () => {
    expect(openPostcard(initialPostcards())).toBeNull();
    const r = openPostcard({ collected: [], waiting: ['p-c01', 'p-c02'], nextAtWall: 1 })!;
    expect(r.id).toBe('p-c01');
    expect(r.isNew).toBe(true);
    expect(r.state).toEqual({ collected: ['p-c01'], waiting: ['p-c02'], nextAtWall: 1 });
  });

  it('a repeat adds nothing to the album and pays no milestone', () => {
    const r = openPostcard({ collected: ['p-c01'], waiting: ['p-c01'], nextAtWall: 1 })!;
    expect(r.isNew).toBe(false);
    expect(r.state.collected).toEqual(['p-c01']);
    expect(r.milestones).toEqual([]);
  });

  it('reports each milestone exactly when the album reaches it', () => {
    for (const m of ALBUM_MILESTONES) {
      const have = POSTCARD_IDS.slice(0, m.at - 1);
      const r = openPostcard({ collected: have, waiting: [POSTCARD_IDS[m.at - 1]], nextAtWall: 1 })!;
      expect(r.milestones).toEqual([m]);
      const after = openPostcard({ collected: POSTCARD_IDS.slice(0, m.at), waiting: [POSTCARD_IDS[m.at]], nextAtWall: 1 })!;
      expect(after.milestones.find((x) => x.at === m.at)).toBeUndefined();
    }
  });
});

describe('postcardSouls', () => {
  it('pays two minutes of souls/sec, capped at 1% of lifetime', () => {
    expect(postcardSouls(new Decimal(10), new Decimal(1e9)).toNumber()).toBe(1200);
    expect(postcardSouls(new Decimal(1e6), new Decimal(1e6)).toNumber()).toBe(1e4);
  });
});

describe('save state', () => {
  it('sanitizes junk and clamps to the catalog and the cap', () => {
    expect(sanitizePostcards(undefined)).toEqual(initialPostcards());
    const s = sanitizePostcards({ collected: ['p-c01', 'p-c01', 'nope', 7], waiting: ['p-c02', 'p-c03', 'p-c04', 'p-c05'], nextAtWall: -4 });
    expect(s).toEqual({ collected: ['p-c01'], waiting: ['p-c02', 'p-c03', 'p-c04'], nextAtWall: 0 });
  });

  it('round-trips through serialize/deserialize and old saves load empty', () => {
    const base = createInitialState({ wall: 0, mono: 0 }, content);
    const s = { ...base, postcards: { collected: ['p-c01', 'p-c05'], waiting: ['p-c09'], nextAtWall: T0 } };
    expect(deserialize(serialize(s), content).postcards).toEqual(s.postcards);
    const raw = JSON.parse(serialize(s));
    delete raw.postcards;
    expect(deserialize(JSON.stringify(raw), content).postcards).toEqual(initialPostcards());
  });
});
