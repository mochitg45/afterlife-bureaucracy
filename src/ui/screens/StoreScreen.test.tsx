import { act, render, screen, fireEvent } from '@testing-library/react';
import { StoreScreen, STORE_FOOTNOTE } from './StoreScreen';
import { useGame } from '../../store/game';
import { createInitialState, type GameState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';
import type { Product } from '../../platform/billing';
import { STARTER_PACK_WINDOW_MS, UNION_PERIOD_MS } from '../../engine/entitlements';

const PRODUCTS: Product[] = [
  { id: 'vouchers_10', price: '$0.99', title: '10 Overtime Vouchers' },
  { id: 'vouchers_55', price: '$4.99', title: '55 Overtime Vouchers' },
  { id: 'vouchers_120', price: '$9.99', title: '120 Overtime Vouchers' },
  { id: 'vouchers_300', price: '$19.99', title: '300 Overtime Vouchers' },
  { id: 'remove_ads', price: '$4.99', title: 'Exempt From Advertising' },
  { id: 'starter_pack', price: '$2.99', title: 'New Clerk Starter Pack' },
  { id: 'union_monthly', price: '$3.99', title: 'Union Membership (monthly)' },
];

/** StoreScreen reads the wall clock directly for the Starter-Pack window and the union expiry. */
const NOW = Date.now();

function seed(patch: Partial<GameState> = {}, store: Partial<Parameters<typeof useGame.setState>[0]> = {}) {
  const state = { ...createInitialState({ wall: NOW, mono: 0 }, content), ...patch };
  useGame.setState({
    state,
    rates: computeRates(state, content, NOW),
    ready: true,
    products: PRODUCTS,
    purchasePending: null,
    ...store,
  });
}

describe('StoreScreen', () => {
  it('lists the four voucher packs with their prices and buys one', async () => {
    const buy = vi.fn(async () => 'ok' as const);
    seed({}, { buy });
    render(<StoreScreen />);
    expect(screen.getByRole('heading', { name: 'Vouchers' })).toBeInTheDocument();
    for (const p of PRODUCTS.slice(0, 4)) {
      expect(screen.getByRole('button', { name: `Buy ${p.title}` })).toHaveTextContent(p.price);
    }
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Buy 55 Overtime Vouchers' })); });
    expect(buy).toHaveBeenCalledWith('vouchers_55');
    expect(screen.getByRole('status')).toHaveTextContent(/filed/i);
  });

  it('reports a cancelled purchase', async () => {
    seed({}, { buy: vi.fn(async () => 'cancelled' as const) });
    render(<StoreScreen />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Buy 10 Overtime Vouchers' })); });
    expect(screen.getByRole('status')).toHaveTextContent(/cancelled/i);
  });

  it('disables every buy button while a purchase is pending', () => {
    seed({}, { purchasePending: 'vouchers_10' });
    render(<StoreScreen />);
    expect(screen.getByRole('button', { name: 'Buy 10 Overtime Vouchers' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Buy Exempt From Advertising' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Purchase pending…');
  });

  it('marks Remove Ads as owned instead of offering it again', () => {
    seed({ entitlements: { removeAds: true, unionUntilWall: 0, starterPackBought: false, firstBuyUsed: {} } });
    render(<StoreScreen />);
    expect(screen.queryByRole('button', { name: 'Buy Exempt From Advertising' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Remove Ads' })).toBeInTheDocument();
    // The copy promises the Backlog Report multiplier and nothing about removing prompts the
    // game never shows anyone.
    expect(screen.getByText(/permanent ×2 on the overnight backlog report/i)).toBeInTheDocument();
    expect(screen.queryByText(/hides every ad prompt/i)).not.toBeInTheDocument();
    expect(screen.getByText('Owned')).toBeInTheDocument();
  });

  it('offers the Starter Pack with its contents while eligible', () => {
    seed({ firstSeenWallClock: NOW });
    render(<StoreScreen />);
    expect(screen.getByRole('heading', { name: 'Starter Pack' })).toBeInTheDocument();
    expect(screen.getByText(/200 Requisition Vouchers/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy New Clerk Starter Pack' })).toBeInTheDocument();
  });

  it('hides the Starter Pack once the window has closed', () => {
    seed({ firstSeenWallClock: NOW - 5 * 86_400_000 });
    render(<StoreScreen />);
    expect(screen.queryByRole('heading', { name: 'Starter Pack' })).not.toBeInTheDocument();
  });

  // The window closes on a wall-clock deadline, not on anything the player does, so a screen
  // left open on the Store tab must stop offering the pack by itself.
  it('drops the Starter Pack when the window lapses while the screen is open', () => {
    vi.useFakeTimers();
    const opened = Date.now();
    try {
      seed({ firstSeenWallClock: opened - STARTER_PACK_WINDOW_MS + 30_000 });
      render(<StoreScreen />);
      expect(screen.getByRole('heading', { name: 'Starter Pack' })).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(120_000); });
      expect(screen.queryByRole('heading', { name: 'Starter Pack' })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the union benefits and its price', () => {
    seed({ firstSeenWallClock: NOW - 5 * 86_400_000 });
    render(<StoreScreen />);
    expect(screen.getByRole('heading', { name: 'Union Membership' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy Union Membership (monthly)' })).toHaveTextContent('$3.99');
    expect(screen.queryByText(/active until/i)).not.toBeInTheDocument();
  });

  it('reports each of the three restore outcomes', async () => {
    for (const [result, text] of [
      ['ok', 'Purchases restored.'],
      ['none', 'Nothing to restore for this account.'],
      ['error', 'The store did not respond. Try again later.'],
    ] as const) {
      seed({}, { restorePurchases: vi.fn(async () => result) });
      const view = render(<StoreScreen />);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restore purchases' })); });
      expect(screen.getByRole('status')).toHaveTextContent(text);
      view.unmount();
    }
  });

  it('shows the expiry date while the membership is active', () => {
    const until = NOW + UNION_PERIOD_MS;
    seed({ entitlements: { removeAds: false, unionUntilWall: until, starterPackBought: false, firstBuyUsed: {} } });
    render(<StoreScreen />);
    expect(screen.getByText(`Active until ${new Date(until).toLocaleDateString()}`)).toBeInTheDocument();
  });

  it('restores purchases', async () => {
    const restorePurchases = vi.fn(async () => 'ok' as const);
    seed({}, { restorePurchases });
    render(<StoreScreen />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restore purchases' })); });
    expect(restorePurchases).toHaveBeenCalled();
  });

  it('prints the virtual-currency footnote', () => {
    seed();
    render(<StoreScreen />);
    expect(screen.getByText(STORE_FOOTNOTE)).toBeInTheDocument();
    expect(STORE_FOOTNOTE).toBe(
      'Requisition Vouchers are a virtual currency with no real-world value. Subscriptions renew monthly until cancelled in Google Play.',
    );
  });

  it('says the desk is closed when the catalogue never arrived', () => {
    seed({}, { products: [] });
    render(<StoreScreen />);
    expect(screen.getByText(/requisition desk is closed/i)).toBeInTheDocument();
  });

  it('shows one product art per visible product', () => {
    seed({ firstSeenWallClock: NOW });
    const { container } = render(<StoreScreen />);
    const shown = ['remove_ads', 'starter_pack', 'union_monthly'];
    for (const id of shown) {
      expect(container.querySelectorAll(`svg[data-product="${id}"]`)).toHaveLength(1);
    }
  });

  it('shows each voucher pack with its own distinct art inside the Vouchers card', () => {
    seed({ firstSeenWallClock: NOW });
    const { container } = render(<StoreScreen />);
    const voucherIds = ['vouchers_10', 'vouchers_55', 'vouchers_120', 'vouchers_300'];
    const arts = voucherIds.map((id) => {
      const el = container.querySelector(`svg[data-product="${id}"]`);
      expect(el).toBeInTheDocument();
      return el!.innerHTML;
    });
    expect(new Set(arts).size).toBe(voucherIds.length);
  });

  it('flags the first-purchase-pays-double copy, pill and badge, then hides all three once used', () => {
    seed({ firstSeenWallClock: NOW });
    const { container, rerender } = render(<StoreScreen />);
    expect(screen.getByText('First purchase pays double: 200 vouchers')).toBeInTheDocument();
    expect(screen.getAllByText(/first purchase pays double/i)).toHaveLength(4);
    expect(screen.getAllByText('2× FIRST PURCHASE')).toHaveLength(4);
    expect(container.querySelector('svg[data-product="vouchers_10"] [data-first-buy-badge]')).toBeInTheDocument();

    seed({ firstSeenWallClock: NOW, entitlements: { removeAds: false, unionUntilWall: 0, starterPackBought: false, firstBuyUsed: { vouchers_10: true } } });
    rerender(<StoreScreen />);
    // vouchers_10's own line, pill and badge are gone; the other three packs are untouched.
    expect(screen.queryByText('First purchase pays double: 200 vouchers')).not.toBeInTheDocument();
    expect(screen.getAllByText(/first purchase pays double/i)).toHaveLength(3);
    expect(screen.getAllByText('2× FIRST PURCHASE')).toHaveLength(3);
    expect(container.querySelector('svg[data-product="vouchers_10"] [data-first-buy-badge]')).not.toBeInTheDocument();
    for (const id of ['vouchers_55', 'vouchers_120', 'vouchers_300']) {
      expect(container.querySelector(`svg[data-product="${id}"] [data-first-buy-badge]`)).toBeInTheDocument();
    }
  });

  it('shows the settings gear', () => {
    const onSettings = vi.fn();
    seed();
    render(<StoreScreen onSettings={onSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(onSettings).toHaveBeenCalled();
  });
});
