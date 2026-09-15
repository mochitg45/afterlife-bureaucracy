import type { AchievementDef } from '../../engine/content';

const OUTLINE = 'var(--ink)';
const SW = 2.5;

const TIER_COLOR: Record<1 | 2 | 3 | 4, string> = {
  1: 'var(--line)',
  2: 'var(--teal)',
  3: 'var(--brass)',
  4: 'var(--red)',
};

/** Rosette/shield base filled by tier colour; shared by every glyph. */
function Base({ fill }: { fill: string }) {
  return (
    <path
      d="M32 4 L54 13 L54 34 C54 50 32 60 32 60 C32 60 10 50 10 34 L10 13 Z"
      fill={fill}
      stroke={OUTLINE}
      strokeWidth={SW}
      strokeLinejoin="round"
    />
  );
}

function Glyph({ kind }: { kind: AchievementDef['badge'] }) {
  switch (kind) {
    case 'stamp':
      return (
        <g stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" fill="none">
          <rect x="20" y="21" width="24" height="16" rx="3" />
          <path d="M24 29 h16" />
        </g>
      );
    case 'trophy':
      return (
        <g stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" fill="none">
          <path d="M23 18 h18 v9 a9 9 0 0 1 -18 0 Z" />
          <path d="M23 20 C17 20 17 28 23 28" />
          <path d="M41 20 C47 20 47 28 41 28" />
          <path d="M32 36 v5" />
          <path d="M26 43 h12" />
        </g>
      );
    case 'star':
      return <path d="M32 16 L35.8 26.2 L46.5 26.2 L37.9 32.6 L41.2 43.4 L32 36.8 L22.8 43.4 L26.1 32.6 L17.5 26.2 L28.2 26.2 Z" fill={OUTLINE} />;
    case 'scroll':
      return (
        <g stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" fill="none">
          <rect x="21" y="20" width="22" height="17" rx="1" />
          <circle cx="21" cy="20" r="3" fill="none" />
          <circle cx="21" cy="37" r="3" fill="none" />
          <path d="M27 26 h11 M27 31 h11" />
        </g>
      );
    case 'flame':
      return (
        <path
          d="M32 16 C25 25 23 30 25 36 C26.5 41 30 43 32 43 C34 43 37.5 41 39 36 C41 30 39 25 32 16 Z M32 30 C29 34 29 38 32 39 C35 38 35 34 32 30 Z"
          fill={OUTLINE}
        />
      );
    case 'gear':
      // Six teeth at 60-degree increments around the hub circle.
      return (
        <g stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" fill="none">
          <circle cx="32" cy="29" r="8" />
          <path d="M40 29 L45 29 M36 35.9 L38.5 40.3 M28 35.9 L25.5 40.3 M24 29 L19 29 M28 22.1 L25.5 17.7 M36 22.1 L38.5 17.7" />
        </g>
      );
    default:
      return null;
  }
}

export interface BadgeProps {
  kind: AchievementDef['badge'];
  tier: 1 | 2 | 3 | 4;
  locked?: boolean;
  size?: number;
}

/** A trophy-style badge icon: a tier-coloured rosette/shield with a glyph for the achievement kind. */
export function Badge({ kind, tier, locked = false, size = 64 }: BadgeProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      data-kind={kind}
      data-tier={tier}
      data-locked={locked}
      style={locked ? { opacity: 0.35, filter: 'grayscale(1)' } : undefined}
      aria-hidden="true"
    >
      <Base fill={TIER_COLOR[tier]} />
      <Glyph kind={kind} />
    </svg>
  );
}
