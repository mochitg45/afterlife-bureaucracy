import type { ReactElement } from 'react';

export type Mood = 'ok' | 'cooked';

const OUTLINE = 'var(--ink)';
const SW = 2.5;

function Face({ mood, cx, cy }: { mood: Mood; cx: number; cy: number }) {
  if (mood === 'ok') {
    return (
      <g data-face="ok" stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" fill={OUTLINE}>
        <circle cx={cx - 5} cy={cy} r={1.6} />
        <circle cx={cx + 5} cy={cy} r={1.6} />
        <path d={`M ${cx - 4} ${cy + 7} Q ${cx} ${cy + 10} ${cx + 4} ${cy + 7}`} fill="none" />
      </g>
    );
  }
  return (
    <g data-face="cooked" stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" fill="none">
      <path d={`M ${cx - 7} ${cy - 2} l 4 4 M ${cx - 3} ${cy - 2} l -4 4`} />
      <path d={`M ${cx + 3} ${cy - 2} l 4 4 M ${cx + 7} ${cy - 2} l -4 4`} />
      <path d={`M ${cx - 4} ${cy + 9} Q ${cx} ${cy + 6} ${cx + 4} ${cy + 9}`} />
    </g>
  );
}

function Dave({ mood }: { mood: Mood }) {
  // Reaper in a hood, holding a scythe like a mop.
  return (
    <>
      <path d="M32 6 C18 6 14 20 14 30 L14 50 L50 50 L50 30 C50 20 46 6 32 6 Z" fill="var(--green)" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="27" r="11" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M50 12 L54 8 M50 12 L50 52" stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" />
      <path d="M50 12 C58 10 60 18 54 20" fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} />
      <rect x="24" y="44" width="16" height="6" rx="1" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <Face mood={mood} cx={32} cy={26} />
    </>
  );
}

function Seraphine({ mood }: { mood: Mood }) {
  // Angel temp with a lanyard and a slightly tilted halo.
  return (
    <>
      <ellipse cx="32" cy="9" rx="10" ry="3" fill="none" stroke="var(--brass)" strokeWidth={SW} transform={mood === 'cooked' ? 'rotate(-12 32 9)' : undefined} />
      <path d="M14 34 C6 30 6 20 14 20 L14 34 Z M50 34 C58 30 58 20 50 20 L50 34 Z" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M20 52 L20 34 C20 26 44 26 44 34 L44 52 Z" fill="var(--teal)" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="22" r="10" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M28 34 L32 44 L36 34" fill="none" stroke={OUTLINE} strokeWidth={SW} />
      <rect x="29" y="42" width="6" height="7" rx="1" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <Face mood={mood} cx={32} cy={21} />
    </>
  );
}

function Gary({ mood }: { mood: Mood }) {
  // Demon intern: horns, tie, coffee cup.
  return (
    <>
      <path d="M22 16 L18 6 L27 13 Z M42 16 L46 6 L37 13 Z" fill="var(--red)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M18 52 L18 36 C18 28 46 28 46 36 L46 52 Z" fill="var(--red)" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="23" r="11" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M32 34 L29 40 L32 46 L35 40 Z" fill="var(--brass)" stroke={OUTLINE} strokeWidth={SW} />
      <rect x="46" y="38" width="8" height="9" rx="1.5" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M54 40 C58 40 58 45 54 45" fill="none" stroke={OUTLINE} strokeWidth={SW} />
      <Face mood={mood} cx={32} cy={22} />
    </>
  );
}

function Auditor({ mood }: { mood: Mood }) {
  // Suit, dark glasses, briefcase with a suspicious bulge.
  return (
    <>
      <path d="M16 52 L16 36 C16 28 48 28 48 36 L48 52 Z" fill="var(--brass)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M26 30 L32 40 L38 30" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="20" r="11" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <rect x="23" y="17" width="8" height="5" rx="1" fill={OUTLINE} />
      <rect x="33" y="17" width="8" height="5" rx="1" fill={OUTLINE} />
      <rect x="44" y="40" width="14" height="10" rx="2" fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M48 40 L48 37 L54 37 L54 40" fill="none" stroke={OUTLINE} strokeWidth={SW} />
      <g stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" fill="none" data-face={mood}>
        {mood === 'ok'
          ? <path d="M29 28 L35 28" />
          : <path d="M28 29 Q32 26 36 29" />}
      </g>
    </>
  );
}

function Soul({ mood }: { mood: Mood }) {
  return (
    <>
      <path d="M32 8 C18 8 16 24 16 34 L16 54 L22 50 L28 54 L34 50 L40 54 L46 50 L48 54 L48 34 C48 24 46 8 32 8 Z" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <Face mood={mood} cx={32} cy={26} />
    </>
  );
}

const REGISTRY: Record<string, (p: { mood: Mood }) => ReactElement> = {
  dave: Dave, seraphine: Seraphine, gary: Gary, auditor: Auditor,
};

export function Character({ id, mood, size = 56 }: { id: string; mood: Mood; size?: number }) {
  const Body = REGISTRY[id] ?? Soul;
  const resolved = REGISTRY[id] ? id : 'soul';
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} data-character={resolved} data-mood={mood} aria-hidden="true">
      <Body mood={mood} />
    </svg>
  );
}
