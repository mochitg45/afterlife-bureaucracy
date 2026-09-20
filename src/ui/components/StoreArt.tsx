import type { ReactElement } from 'react';
import type { ProductId } from '../../platform/billing';
import { StampSeal } from './StampButton';

const OUTLINE = 'var(--ink)';
const SW = 2.5;

/** One requisition-voucher ticket: a stub with a torn dashed edge. */
function Ticket({ x, y, rotate = 0 }: { x: number; y: number; rotate?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x={-14} y={-8} width={28} height={16} rx={2} fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} />
      <line x1={4} y1={-8} x2={4} y2={8} stroke={OUTLINE} strokeWidth={1.5} strokeDasharray="2 2" />
      <circle cx={9} cy={0} r={2.5} fill="var(--brass)" stroke={OUTLINE} strokeWidth={1.5} />
    </g>
  );
}

const ART: Record<ProductId, ReactElement> = {
  vouchers_10: <Ticket x={32} y={32} />,
  vouchers_55: (
    <>
      <Ticket x={26} y={36} rotate={-12} />
      <Ticket x={38} y={30} rotate={10} />
    </>
  ),
  vouchers_120: (
    <>
      <Ticket x={32} y={22} />
      <Ticket x={32} y={34} />
      <Ticket x={32} y={46} />
      <rect x={16} y={28} width={4} height={24} rx={2} fill="var(--red)" stroke={OUTLINE} strokeWidth={2} />
    </>
  ),
  vouchers_300: (
    <>
      <rect x={10} y={40} width={44} height={16} rx={2} fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} />
      <Ticket x={22} y={34} rotate={-8} />
      <Ticket x={32} y={30} />
      <Ticket x={42} y={34} rotate={8} />
      <circle cx={32} cy={16} r={9} fill="var(--brass)" stroke={OUTLINE} strokeWidth={SW} />
    </>
  ),
  remove_ads: (
    <>
      <g transform="translate(-8 -8) scale(0.53)">
        <StampSeal size={64} />
      </g>
      <g transform="translate(4 4)" stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round">
        <path d="M46 20 L58 14 L58 34 L46 28 Z" fill="var(--surface)" />
        <line x1="44" y1="14" x2="60" y2="34" stroke="var(--red)" strokeWidth={3} />
      </g>
    </>
  ),
  starter_pack: (
    <>
      <path d="M10 26 L26 26 L30 20 L54 20 L54 50 L10 50 Z" fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <circle cx="32" cy="18" r="7" fill="var(--brass)" stroke={OUTLINE} strokeWidth={2} />
      <path d="M27 16 q5 -6 10 0" fill="none" stroke={OUTLINE} strokeWidth={1.5} />
    </>
  ),
  union_monthly: (
    <>
      <path d="M24 32 L18 54 L32 46 L46 54 L40 32 Z" fill="var(--red)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <circle cx="32" cy="24" r="16" fill="var(--brass)" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="24" r="9" fill="var(--surface)" stroke={OUTLINE} strokeWidth={2} />
    </>
  ),
};

/**
 * Badge for a pack whose first purchase pays double: a red disc about 45% of the art's width,
 * overlapping the top-right corner, with a thick cream "2x" drawn as paths (no <text>).
 */
function DoubleBadge() {
  return (
    <g data-first-buy-badge="true">
      <circle cx={47} cy={15} r={14.5} fill="var(--red)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M39 12 Q39 8 43 8 Q47 8 47 11.5 Q47 14.5 43 18.5 L39 22.5 L47 22.5" fill="none" stroke="#F7F2E4" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 9 L58 22.5 M58 9 L50 22.5" fill="none" stroke="#F7F2E4" strokeWidth={5} strokeLinecap="round" />
    </g>
  );
}

export function StoreArt({ productId, size = 56, firstBuy = false }: { productId: ProductId; size?: number; firstBuy?: boolean }): ReactElement {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} data-product={productId} aria-hidden="true">
      {ART[productId]}
      {firstBuy && <DoubleBadge />}
    </svg>
  );
}
