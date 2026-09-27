/**
 * The two soft currencies as chibi-sticker SVGs: thick ink outline, flat palette fills and a
 * slight tilt, drawn on a 24-unit grid so they stay legible from 14px up to 24px.
 *
 * Both are decorative (aria-hidden): whoever places one next to a number owns the accessible
 * text ("90 vouchers"), since the glyph alone says nothing to a screen reader.
 */
const INK = '#2A2620';
const CREAM = '#F7F2E4';
const RED = '#A6402B';
const BRASS = '#A8823C';
const BRASS_DARK = '#7A5E28';
const GOLD = '#E8C66A';
const BRASS_LIGHT = '#D6B060';

interface IconProps {
  size?: number;
  className?: string;
}

/** Requisition Voucher: a cream ticket with notched sides, a dashed tear line and a red wax seal. */
export function VoucherIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={'cur-icon' + (className ? ' ' + className : '')}
      data-icon="voucher"
    >
      <g transform="rotate(-10 12 12)" strokeLinejoin="round" strokeLinecap="round">
        <path
          d="M4 6 H20 Q22 6 22 8 V9.5 A2.5 2.5 0 0 0 22 14.5 V16 Q22 18 20 18 H4 Q2 18 2 16 V14.5 A2.5 2.5 0 0 0 2 9.5 V8 Q2 6 4 6 Z"
          fill={CREAM}
          stroke={INK}
          strokeWidth={1.9}
        />
        <line x1={15.5} y1={8} x2={15.5} y2={16} stroke={INK} strokeWidth={1.3} strokeDasharray="1.6 1.6" />
        <circle cx={9} cy={12} r={3.6} fill={RED} stroke={INK} strokeWidth={1.6} />
        <circle cx={9} cy={12} r={1.7} fill="none" stroke={CREAM} strokeWidth={0.9} opacity={0.75} />
        <line x1={18.2} y1={10} x2={19.6} y2={10} stroke={INK} strokeWidth={1.1} opacity={0.5} />
        <line x1={18.2} y1={12.4} x2={19.6} y2={12.4} stroke={INK} strokeWidth={1.1} opacity={0.5} />
      </g>
    </svg>
  );
}

/** Karma Credit: a chunky brass coin with a darker rim, a floating halo and an embossed yin-yang. */
export function KarmaIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={'cur-icon' + (className ? ' ' + className : '')}
      data-icon="karma"
    >
      <g transform="rotate(8 12 13)" strokeLinejoin="round" strokeLinecap="round">
        {/* Halo: an ink stroke under a gold one reads as an outlined ring at sticker scale. */}
        <ellipse cx={12} cy={3.6} rx={5} ry={1.7} fill="none" stroke={INK} strokeWidth={2.8} />
        <ellipse cx={12} cy={3.6} rx={5} ry={1.7} fill="none" stroke={GOLD} strokeWidth={1.3} />
        <circle cx={12} cy={14} r={8.2} fill={BRASS} stroke={INK} strokeWidth={1.9} />
        <circle cx={12} cy={14} r={6.4} fill={BRASS_LIGHT} stroke={BRASS_DARK} strokeWidth={1.1} />
        <path d="M7.4 11.6 A5 5 0 0 1 10.2 8.8" fill="none" stroke={CREAM} strokeWidth={1.2} opacity={0.8} />
        <circle cx={12} cy={14} r={3.4} fill={CREAM} stroke={BRASS_DARK} strokeWidth={1} />
        <path d="M12 10.6 A3.4 3.4 0 0 1 12 17.4 A1.7 1.7 0 0 1 12 14 A1.7 1.7 0 0 0 12 10.6 Z" fill={BRASS_DARK} />
        <circle cx={12} cy={12.3} r={0.6} fill={BRASS_DARK} />
        <circle cx={12} cy={15.7} r={0.6} fill={CREAM} />
      </g>
    </svg>
  );
}

/** Karma Seal: a wavy-edged sealing-wax blob with a brass rim pressed with a star. */
export function SealIcon({ size = 16, className }: IconProps) {
  // Scalloped wax edge: 10 bumps around the centre.
  const bumps = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    const r = i % 2 === 0 ? 9.6 : 8.3;
    return `${(12 + Math.cos(a) * r).toFixed(2)} ${(12.5 + Math.sin(a) * r).toFixed(2)}`;
  });
  const star = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? 3.4 : 1.5;
    return `${(12 + Math.cos(a) * r).toFixed(2)} ${(12.5 + Math.sin(a) * r).toFixed(2)}`;
  });
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={'cur-icon' + (className ? ' ' + className : '')}
      data-icon="seal"
    >
      <g transform="rotate(-8 12 12.5)" strokeLinejoin="round" strokeLinecap="round">
        <path d={`M${bumps.join(' L')} Z`} fill={RED} stroke={INK} strokeWidth={1.8} />
        <circle cx={12} cy={12.5} r={5.6} fill={BRASS_LIGHT} stroke={BRASS_DARK} strokeWidth={1.2} />
        <path d={`M${star.join(' L')} Z`} fill={BRASS_DARK} />
        <path d="M6.2 9.6 A7 7 0 0 1 9 6.6" fill="none" stroke={CREAM} strokeWidth={1.1} opacity={0.7} />
      </g>
    </svg>
  );
}
