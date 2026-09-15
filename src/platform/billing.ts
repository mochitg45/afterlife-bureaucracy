import { Capacitor } from '@capacitor/core';
import { Purchases, PRODUCT_CATEGORY, PURCHASES_ERROR_CODE } from '@revenuecat/purchases-capacitor';
import type { CustomerInfo, PurchasesStoreProduct } from '@revenuecat/purchases-capacitor';
import { isDevBuild } from './adUnits';

export type ProductId =
  | 'vouchers_10'
  | 'vouchers_55'
  | 'vouchers_120'
  | 'vouchers_300'
  | 'remove_ads'
  | 'starter_pack'
  | 'union_monthly';

export const PRODUCT_IDS: readonly ProductId[] = [
  'vouchers_10',
  'vouchers_55',
  'vouchers_120',
  'vouchers_300',
  'remove_ads',
  'starter_pack',
  'union_monthly',
] as const;

/** The only subscription; everything else is a one-shot or non-consumable purchase. */
export const SUBSCRIPTION_PRODUCT_IDS: readonly ProductId[] = ['union_monthly'] as const;

/** RevenueCat entitlement identifiers, as configured in the RevenueCat dashboard. */
export const ENTITLEMENT_REMOVE_ADS = 'remove_ads';
export const ENTITLEMENT_UNION = 'union';

/**
 * Public RevenueCat SDK keys. Public by design — they identify the app to RevenueCat and
 * ship inside the APK. Secret keys never appear in this repository.
 */
export const REVENUECAT_TEST_KEY = 'test_KVdHDShyXRlyPVWbhZFJxMJFQLg';
export const REVENUECAT_PLAY_KEY = 'goog_qrKNtlMXOEqzWLCObOPioONRTFb';

export function revenueCatApiKey(dev: boolean = isDevBuild()): string {
  return dev ? REVENUECAT_TEST_KEY : REVENUECAT_PLAY_KEY;
}

/**
 * Wall-clock stamp used for an active Union entitlement with no expiry date (a lifetime
 * grant or a promo). Year 3000 — far enough out to read as "no expiry", small enough to
 * stay safe in date arithmetic.
 */
export const UNION_NO_EXPIRY_WALL = 32_503_680_000_000;

export interface Product {
  id: ProductId;
  price: string;
  title: string;
}
export type PurchaseResult = 'ok' | 'cancelled' | 'error';
export interface Restored {
  removeAds: boolean;
  unionUntilWall: number;
  starterPackBought: boolean;
}
export interface Billing {
  init(): Promise<void>;
  products(): Promise<Product[]>;
  purchase(id: ProductId): Promise<PurchaseResult>;
  restore(): Promise<Restored>;
}

/** How long the web mock pretends a purchase flow takes. */
export const WEB_PURCHASE_DURATION_MS = 300;

const WEB_CATALOGUE: Record<ProductId, { price: string; title: string }> = {
  vouchers_10: { price: '$0.99', title: '10 Overtime Vouchers' },
  vouchers_55: { price: '$4.99', title: '55 Overtime Vouchers' },
  vouchers_120: { price: '$9.99', title: '120 Overtime Vouchers' },
  vouchers_300: { price: '$19.99', title: '300 Overtime Vouchers' },
  remove_ads: { price: '$4.99', title: 'Exempt From Advertising' },
  starter_pack: { price: '$2.99', title: 'New Clerk Starter Pack' },
  union_monthly: { price: '$3.99', title: 'Union Membership (monthly)' },
};

/** Browser and test fallback: mock catalogue, purchases always succeed, nothing to restore. */
export const webBilling: Billing = {
  async init() {},
  async products() {
    return PRODUCT_IDS.map((id) => ({ id, ...WEB_CATALOGUE[id] }));
  },
  purchase() {
    return new Promise<PurchaseResult>((resolve) => {
      setTimeout(() => resolve('ok'), WEB_PURCHASE_DURATION_MS);
    });
  },
  async restore() {
    return { removeAds: false, unionUntilWall: 0, starterPackBought: false };
  },
};

function readEntitlements(customerInfo: CustomerInfo): Restored {
  const active = customerInfo.entitlements.active ?? {};
  const union = active[ENTITLEMENT_UNION];
  return {
    removeAds: Boolean(active[ENTITLEMENT_REMOVE_ADS]?.isActive),
    unionUntilWall: union?.isActive ? (union.expirationDateMillis ?? UNION_NO_EXPIRY_WALL) : 0,
    starterPackBought: (customerInfo.allPurchasedProductIdentifiers ?? []).includes('starter_pack'),
  };
}

const NOTHING_RESTORED: Restored = { removeAds: false, unionUntilWall: 0, starterPackBought: false };

/**
 * RevenueCat billing. Every SDK call is guarded so a store outage degrades to an empty
 * catalogue or an `'error'` result instead of throwing into the UI.
 *
 * Not exercised by tests — there is no Play Billing under jsdom. Typed against the
 * plugin's published definitions and covered by `tsc` only.
 */
export const revenueCatBilling: Billing = (() => {
  async function fetchProducts(ids: readonly ProductId[], type: PRODUCT_CATEGORY): Promise<PurchasesStoreProduct[]> {
    if (ids.length === 0) return [];
    try {
      const { products } = await Purchases.getProducts({ productIdentifiers: [...ids], type });
      return products;
    } catch {
      return [];
    }
  }

  async function findProduct(id: ProductId): Promise<PurchasesStoreProduct | undefined> {
    const category = SUBSCRIPTION_PRODUCT_IDS.includes(id)
      ? PRODUCT_CATEGORY.SUBSCRIPTION
      : PRODUCT_CATEGORY.NON_SUBSCRIPTION;
    return (await fetchProducts([id], category)).find((p) => p.identifier === id);
  }

  return {
    async init() {
      try {
        await Purchases.configure({ apiKey: revenueCatApiKey() });
      } catch {
        /* unconfigured: every later call degrades on its own */
      }
    },

    async products() {
      const oneOff = PRODUCT_IDS.filter((id) => !SUBSCRIPTION_PRODUCT_IDS.includes(id));
      const [nonSubs, subs] = await Promise.all([
        fetchProducts(oneOff, PRODUCT_CATEGORY.NON_SUBSCRIPTION),
        fetchProducts(SUBSCRIPTION_PRODUCT_IDS, PRODUCT_CATEGORY.SUBSCRIPTION),
      ]);
      const byId = new Map(
        [...nonSubs, ...subs].map((p) => [p.identifier, { price: p.priceString, title: p.title }] as const),
      );
      // Keep the catalogue in the declared order and drop anything the store did not return.
      return PRODUCT_IDS.flatMap((id) => {
        const found = byId.get(id);
        return found ? [{ id, price: found.price, title: found.title }] : [];
      });
    },

    async purchase(id) {
      const product = await findProduct(id);
      if (!product) return 'error';
      try {
        await Purchases.purchaseStoreProduct({ product });
        return 'ok';
      } catch (err) {
        const e = err as { code?: string; userCancelled?: boolean | null };
        const cancelled = e?.userCancelled === true || e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
        return cancelled ? 'cancelled' : 'error';
      }
    },

    async restore() {
      try {
        const { customerInfo } = await Purchases.restorePurchases();
        return readEntitlements(customerInfo);
      } catch {
        return { ...NOTHING_RESTORED };
      }
    },
  };
})();

export function pickBilling(): Billing {
  return Capacitor.isNativePlatform() ? revenueCatBilling : webBilling;
}
