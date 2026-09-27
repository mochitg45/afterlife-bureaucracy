import { render, screen, fireEvent, act } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { Tips, pickTip, type TipContext } from './Tips';
import { useGame } from '../../store/game';
import { createInitialState, type GameState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { auditThreshold } from '../../engine/prestige';
import { content } from '../../data';

const tip = (id: string) => content.onboarding.tips.find((t) => t.id === id)!;
const office: TipContext = { tab: 'office', offlineClosed: false };

function trained(patch: Partial<GameState> = {}): GameState {
  const s = createInitialState({ wall: 0, mono: 0 }, content);
  return { ...s, onboarding: { memosSeen: true, trainingStep: 3, tipsSeen: [] }, ...patch };
}

function seed(state: GameState) {
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, pendingOffline: null });
}

describe('pickTip', () => {
  it('shows nothing during Training', () => {
    const s = trained({ staff: { dave: 1 } });
    expect(pickTip({ ...s, onboarding: { ...s.onboarding, trainingStep: 2 } }, content, office)).toBeNull();
    expect(pickTip(s, content, office)?.id).toBe('speed-bar');
  });

  it('points at the milestone after the second hire, with the next milestone filled in', () => {
    const s = trained({ staff: { dave: 2 }, stats: { ...trained().stats, staffHired: 2 }, onboarding: { memosSeen: true, trainingStep: 3, tipsSeen: ['speed-bar'] } });
    const t = pickTip(s, content, office)!;
    expect(t.id).toBe('staff-milestone');
    expect(t.text).toContain('The next one is at 10.');
  });

  it('offers buy-mode when two hires are affordable and upgrades when the first one is', () => {
    const seen = { memosSeen: true, trainingStep: 3, tipsSeen: ['speed-bar', 'staff-milestone'] };
    expect(pickTip(trained({ kc: new Decimal(40), onboarding: seen }), content, office)?.id).toBe('buy-mode');
    const t = pickTip(trained({ kc: new Decimal(60), onboarding: { ...seen, tipsSeen: [...seen.tipsSeen, 'buy-mode'] } }), content, office);
    expect(t?.id).toBe('upgrades');
  });

  it('shows the offline tip once the first report has closed', () => {
    expect(pickTip(trained(), content, office)).toBeNull();
    expect(pickTip(trained(), content, { ...office, offlineClosed: true })?.id).toBe('offline');
  });

  it('greets each tab once, and the Ledger tip also fires when an Audit becomes possible', () => {
    expect(pickTip(trained(), content, { tab: 'personnel', offlineClosed: false })?.text).toContain('one for 10, ten for 90');
    expect(pickTip(trained(), content, { tab: 'tasks', offlineClosed: false })?.id).toBe('tasks-intro');
    expect(pickTip(trained(), content, { tab: 'ledger', offlineClosed: false })?.id).toBe('ledger-intro');
    expect(pickTip(trained({ soulsRun: auditThreshold(1) }), content, office)?.id).toBe('ledger-intro');
  });

  it('explains stars on the first duplicate with the copies still needed', () => {
    const seen = { memosSeen: true, trainingStep: 3, tipsSeen: ['personnel-intro', 'equip'] };
    const t = pickTip(trained({ cards: { 'c-dave-overtime': 1 }, cardShards: { 'c-dave-overtime': 1 }, onboarding: seen }), content, { tab: 'personnel', offlineClosed: false });
    expect(t?.id).toBe('stars');
    expect(t?.text).toMatch(/needs 1 more/);
  });

  it('points at a newly opened department', () => {
    expect(pickTip(trained({ deptsUnlocked: ['intake', 'limbo'] }), content, office)?.id).toBe('dept-unlock');
  });
});

describe('Tips overlay', () => {
  afterEach(() => document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove()));

  it('shows a tip once: Got it marks it seen and it does not come back', () => {
    seed(trained());
    const { rerender } = render(<Tips tab="tasks" />);
    expect(screen.getByText(tip('tasks-intro').title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(useGame.getState().state.onboarding.tipsSeen).toEqual(['tasks-intro']);
    rerender(<Tips tab="tasks" />);
    expect(screen.queryByText(tip('tasks-intro').title)).toBeNull();
  });

  it('is skippable', () => {
    seed(trained());
    render(<Tips tab="ledger" />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(useGame.getState().state.onboarding.tipsSeen).toEqual(['ledger-intro']);
    expect(screen.queryByText(tip('ledger-intro').title)).toBeNull();
  });

  it('is blocked while Training runs', () => {
    const s = trained();
    seed({ ...s, onboarding: { ...s.onboarding, trainingStep: 1 } });
    const { container } = render(<Tips tab="tasks" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('waits for an open dialog to close', async () => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    seed(trained());
    render(<Tips tab="tasks" />);
    expect(screen.queryByText(tip('tasks-intro').title)).toBeNull();
    await act(async () => { backdrop.remove(); });
    expect(screen.getByText(tip('tasks-intro').title)).toBeInTheDocument();
  });

  it('Replay tips clears the seen list and restarts Training', () => {
    seed(trained({ onboarding: { memosSeen: true, trainingStep: 3, tipsSeen: ['equip', 'offline'] } }));
    useGame.getState().replayTips();
    expect(useGame.getState().state.onboarding).toEqual({ memosSeen: true, trainingStep: 0, tipsSeen: [] });
  });
});
