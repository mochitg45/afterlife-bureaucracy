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

type Accessory = 'none' | 'glasses' | 'tie' | 'clipboard' | 'hat';
const ACCESSORIES: Accessory[] = ['none', 'glasses', 'tie', 'clipboard', 'hat'];

function AccessoryLayer({ kind, cx, cy }: { kind: Accessory; cx: number; cy: number }) {
  switch (kind) {
    case 'glasses':
      return <g data-accessory="glasses" stroke={OUTLINE} strokeWidth={SW} fill="none"><circle cx={cx - 5} cy={cy} r={4} /><circle cx={cx + 5} cy={cy} r={4} /><path d={`M ${cx - 1} ${cy} h 2`} /></g>;
    case 'tie':
      return <path data-accessory="tie" d={`M ${cx} ${cy + 14} l -3 6 l 3 8 l 3 -8 z`} fill="var(--brass)" stroke={OUTLINE} strokeWidth={SW} />;
    case 'clipboard':
      return <g data-accessory="clipboard"><rect x={cx + 10} y={cy + 14} width={10} height={13} rx={1.5} fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} /><path d={`M ${cx + 13} ${cy + 18} h 4 M ${cx + 13} ${cy + 22} h 4`} stroke={OUTLINE} strokeWidth={1.5} /></g>;
    case 'hat':
      return <g data-accessory="hat"><rect x={cx - 12} y={cy - 16} width={24} height={4} rx={1} fill={OUTLINE} /><rect x={cx - 8} y={cy - 26} width={16} height={11} rx={1.5} fill={OUTLINE} /></g>;
    default:
      return null;
  }
}

function Angel({ mood, accessory }: { mood: Mood; accessory: Accessory }) {
  return (
    <>
      <ellipse cx="32" cy="8" rx="9" ry="2.5" fill="none" stroke="var(--brass)" strokeWidth={SW} />
      <path d="M12 36 C4 32 4 22 12 22 L12 36 Z M52 36 C60 32 60 22 52 22 L52 36 Z" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M19 54 L19 34 C19 27 45 27 45 34 L45 54 Z" fill="var(--teal)" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="22" r="10" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <Face mood={mood} cx={32} cy={21} />
      <AccessoryLayer kind={accessory} cx={32} cy={21} />
    </>
  );
}

function Demon({ mood, accessory }: { mood: Mood; accessory: Accessory }) {
  return (
    <>
      <path d="M22 15 L17 5 L27 12 Z M42 15 L47 5 L37 12 Z" fill="var(--red)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M17 54 L17 36 C17 28 47 28 47 36 L47 54 Z" fill="var(--red)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M47 44 C56 40 58 48 52 52" fill="none" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="23" r="11" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <Face mood={mood} cx={32} cy={22} />
      <AccessoryLayer kind={accessory} cx={32} cy={22} />
    </>
  );
}

function Clerk({ mood, accessory }: { mood: Mood; accessory: Accessory }) {
  return (
    <>
      <path d="M18 54 L18 36 C18 28 46 28 46 36 L46 54 Z" fill="var(--brass)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M26 30 L32 40 L38 30" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="21" r="11" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M21 18 C24 10 40 10 43 18" fill={OUTLINE} />
      <Face mood={mood} cx={32} cy={21} />
      <AccessoryLayer kind={accessory} cx={32} cy={21} />
    </>
  );
}

function Archivist({ mood, accessory }: { mood: Mood; accessory: Accessory }) {
  return (
    <>
      <path d="M18 54 L18 34 C18 26 46 26 46 34 L46 54 Z" fill="var(--violet)" stroke={OUTLINE} strokeWidth={SW} />
      <rect x="10" y="40" width="10" height="12" rx="1" fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M12 44 h 6 M12 48 h 6" stroke={OUTLINE} strokeWidth={1.5} />
      <circle cx="32" cy="21" r="11" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M22 16 C26 8 38 8 42 16 L40 12 L36 15 L32 11 L28 15 L24 12 Z" fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <Face mood={mood} cx={32} cy={21} />
      <AccessoryLayer kind={accessory} cx={32} cy={21} />
    </>
  );
}

const ARCHETYPES: Record<string, (p: { mood: Mood; accessory: Accessory }) => ReactElement> = {
  angel: Angel, demon: Demon, clerk: Clerk, archivist: Archivist,
};

export function Character({ id, mood, size = 56 }: { id: string; mood: Mood; size?: number }) {
  const [arch, variantStr] = id.split(':');
  const Arch = ARCHETYPES[arch];
  if (Arch) {
    const variant = Math.min(ACCESSORIES.length - 1, Math.max(0, Number(variantStr ?? 0) || 0));
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} data-character={arch} data-variant={variant} data-mood={mood} aria-hidden="true">
        <Arch mood={mood} accessory={ACCESSORIES[variant]} />
      </svg>
    );
  }
  const Body = REGISTRY[id] ?? Soul;
  const resolved = REGISTRY[id] ? id : 'soul';
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} data-character={resolved} data-mood={mood} aria-hidden="true">
      <Body mood={mood} />
    </svg>
  );
}
