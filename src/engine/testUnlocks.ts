import Decimal from 'break_infinity.js';
import type { Content } from './content';
import type { GameState } from './state';
import { FREE_PET, PREMIUM_STAFF, grantPremium } from './premium';

/**
 * Phone test builds only (VITE_TEST_UNLOCKS=1, set in .env.testads): opens every department,
 * card, premium hire and pet, and tops up currencies, so new content deep in progression can be
 * checked at once. Only ever raises values, so running it on each boot is harmless. Never in a
 * store build: the store release is built without the testads mode.
 */
export function openEverything(s: GameState, content: Content): GameState {
  const big = (d: Decimal, v: number) => Decimal.max(d, new Decimal(v));
  const cards = { ...s.cards };
  for (const c of content.cards) if (!c.event || c.rarity === 'executive') cards[c.id] = Math.max(cards[c.id] ?? 0, 3);
  const staff = { ...s.staff };
  for (const d of content.departments) for (const st of d.staff) staff[st.id] = Math.max(staff[st.id] ?? 0, 10);
  const branches = content.departments.map((d) => d.branch).filter((b): b is string => !!b);
  const opened = grantPremium(s, [...PREMIUM_STAFF.map((p) => p.id), FREE_PET.id]);
  return {
    ...opened,
    onboarding: { ...s.onboarding, memosSeen: true, trainingStep: Math.max(s.onboarding.trainingStep, 3) },
    branchesUnlocked: [...new Set([...s.branchesUnlocked, ...branches])],
    deptsUnlocked: content.departments.map((d) => d.id),
    kc: big(s.kc, 1e15),
    soulsRun: big(s.soulsRun, 1e15),
    soulsLifetime: big(s.soulsLifetime, 1e15),
    vouchers: Math.max(s.vouchers, 5000),
    eventVouchers: { weekly: Math.max(s.eventVouchers.weekly, 500), special: Math.max(s.eventVouchers.special, 500) },
    cards,
    staff,
    pets: { ...s.pets, treats: Math.max(s.pets.treats, 50) },
  };
}
