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

// ---------------------------------------------------------------------------
// Parts kit: one portrait per card. Each card is a row in PORTRAITS below.
// Same 64-grid; head at (32,21) r11, props live on the right.
// ---------------------------------------------------------------------------

const GOLD = '#E0A65A';
const FIRE = '#F07030';
const PINK = '#E8A0B0';

type Body = 'blazer' | 'hood' | 'robe' | 'sheet' | 'cloud';
type Hair = 'bun' | 'grey' | 'spiky';
type Head = 'halo' | 'horns' | 'cap' | 'crown' | 'hardhat' | 'headset' | 'wings';
type FaceExtra = 'glasses' | 'shades' | 'moustache' | 'blush';
type Prop =
  | 'scythe' | 'coffee' | 'clipboard' | 'keys' | 'tray' | 'receipts' | 'pitchfork'
  | 'harp' | 'wheel' | 'briefcase' | 'box' | 'hymn' | 'scales' | 'halos' | 'fruit'
  | 'dice' | 'flame' | 'stamp' | 'lotus';
type Shape = 'dog' | 'stapler' | 'cabinet' | 'halos';

type Parts = {
  shape?: Shape;
  body?: Body;
  fill?: string;
  hair?: Hair;
  hairFill?: string;
  head?: Head[];
  face?: FaceExtra;
  prop?: Prop;
};

const ink = { stroke: OUTLINE, strokeWidth: SW } as const;
const thin = { stroke: OUTLINE, strokeWidth: 1.5, fill: 'none' } as const;

function BodyPart({ kind, fill }: { kind: Body; fill: string }) {
  switch (kind) {
    case 'hood':
      return <path d="M32 6 C18 6 14 20 14 30 L14 52 L50 52 L50 30 C50 20 46 6 32 6 Z" fill={fill} {...ink} />;
    case 'robe':
      return <g><path d="M20 54 L23 34 C23 28 41 28 41 34 L44 54 Z" fill={fill} {...ink} strokeLinejoin="round" /><path d="M23 41 h18" {...ink} /></g>;
    case 'sheet':
      return <path d="M32 8 C18 8 16 24 16 34 L16 54 L22 50 L28 54 L34 50 L40 54 L46 50 L48 54 L48 34 C48 24 46 8 32 8 Z" fill={fill} {...ink} strokeLinejoin="round" />;
    case 'cloud':
      return <path d="M18 54 C10 54 10 44 18 44 C18 37 30 34 34 40 C42 35 50 41 46 45 C54 45 54 54 46 54 Z" fill={fill} {...ink} strokeLinejoin="round" />;
    default:
      return <g><path d="M18 54 L18 36 C18 28 46 28 46 36 L46 54 Z" fill={fill} {...ink} /><path d="M26 30 L32 40 L38 30" fill="var(--surface)" {...ink} /></g>;
  }
}

function HairPart({ kind, fill }: { kind: Hair; fill: string }) {
  switch (kind) {
    case 'bun':
      return <g data-hair="bun"><circle cx="32" cy="6" r="5" fill={fill} {...ink} /><path d="M21 18 C24 8 40 8 43 18 Z" fill={fill} {...ink} /></g>;
    case 'spiky':
      return <path data-hair="spiky" d="M20 17 L23 8 L27 14 L31 6 L35 14 L39 8 L42 17 Z" fill={fill} {...ink} strokeLinejoin="round" />;
    default:
      return <path data-hair="grey" d="M21 18 C24 9 40 9 43 18 Z" fill={fill} {...ink} />;
  }
}

function HeadPart({ kind }: { kind: Head }) {
  switch (kind) {
    case 'halo':
      return <ellipse data-head="halo" cx="32" cy="6" rx="9" ry="2.5" fill="none" stroke="var(--brass)" strokeWidth={SW} />;
    case 'horns':
      return <path data-head="horns" d="M22 15 L17 5 L27 12 Z M42 15 L47 5 L37 12 Z" fill="var(--red)" {...ink} strokeLinejoin="round" />;
    case 'cap':
      return <g data-head="cap"><path d="M22 13 C23 4 41 4 42 13 Z" fill="var(--teal)" {...ink} /><rect x="19" y="12" width="26" height="4" rx="1.5" fill={OUTLINE} /><rect x="9" y="13" width="12" height="3" rx="1.5" fill={OUTLINE} /></g>;
    case 'crown':
      return <path data-head="crown" d="M22 12 L24 4 L28 9 L32 3 L36 9 L40 4 L42 12 Z" fill="var(--brass)" {...ink} strokeLinejoin="round" />;
    case 'hardhat':
      return <g data-head="hardhat"><path d="M22 13 C23 3 41 3 42 13 Z" fill="var(--brass)" {...ink} /><rect x="17" y="12" width="30" height="4" rx="2" fill="var(--brass)" {...ink} /></g>;
    case 'headset':
      return <g data-head="headset"><path d="M20 21 C20 8 44 8 44 21" fill="none" {...ink} /><rect x="15" y="18" width="6" height="9" rx="2" fill="var(--surface-2)" {...ink} /><rect x="43" y="18" width="6" height="9" rx="2" fill="var(--surface-2)" {...ink} /><path d="M45 27 C45 33 38 33 36 30" fill="none" {...ink} /></g>;
    default:
      return <path data-head="wings" d="M12 36 C4 32 4 22 12 22 L12 36 Z M52 36 C60 32 60 22 52 22 L52 36 Z" fill="var(--surface)" {...ink} />;
  }
}

function FaceExtraPart({ kind }: { kind: FaceExtra }) {
  switch (kind) {
    case 'glasses':
      return <g data-extra="glasses" fill="none" {...ink}><circle cx="27" cy="21" r="4.5" /><circle cx="37" cy="21" r="4.5" /><path d="M31.5 21 h1" /></g>;
    case 'shades':
      return <g data-extra="shades"><rect x="22" y="18" width="9" height="6" rx="1.5" fill={OUTLINE} /><rect x="33" y="18" width="9" height="6" rx="1.5" fill={OUTLINE} /><path d="M31 20 h2" {...ink} /></g>;
    case 'moustache':
      return <path data-extra="moustache" d="M26 26 Q29 30 32 26 Q35 30 38 26" fill="none" {...ink} strokeLinecap="round" />;
    default:
      return <g data-extra="blush" fill="var(--red)" opacity="0.45"><ellipse cx="23" cy="24" rx="3" ry="2" /><ellipse cx="41" cy="24" rx="3" ry="2" /></g>;
  }
}

function PropPart({ kind }: { kind: Prop }) {
  switch (kind) {
    case 'scythe':
      return <g data-prop="scythe"><path d="M50 12 L50 54 M50 12 L54 8" {...ink} strokeLinecap="round" /><path d="M50 12 C58 10 60 18 54 20" fill="var(--surface-2)" {...ink} /></g>;
    case 'coffee':
      return <g data-prop="coffee"><path d="M44 38 h11 l-1.5 13 h-8 Z" fill="var(--surface)" {...ink} /><path d="M55 40 c4 0 4 6 0 6" fill="none" {...ink} /><path d="M46 34 c2 -3 -2 -4 0 -7" {...thin} /></g>;
    case 'clipboard':
      return <g data-prop="clipboard"><rect x="44" y="34" width="14" height="18" rx="1.5" fill="var(--surface-2)" {...ink} /><rect x="47" y="31" width="8" height="4" rx="1" fill={OUTLINE} /><path d="M47 41 h8 M47 46 h8" {...thin} /></g>;
    case 'keys':
      return <g data-prop="keys"><circle cx="50" cy="36" r="5" fill="none" {...ink} /><path d="M50 41 L50 54 M50 47 h5 M50 51 h5" fill="none" {...ink} /></g>;
    case 'tray':
      return <g data-prop="tray"><circle cx="45" cy="40" r="4.5" fill="var(--brass)" {...ink} /><circle cx="55" cy="40" r="4.5" fill="var(--red)" {...ink} /><rect x="38" y="44" width="24" height="5" rx="2" fill="var(--surface-2)" {...ink} /></g>;
    case 'receipts':
      return <g data-prop="receipts"><path d="M44 32 h13 v21 l-3.2 -2 l-3.3 2 l-3.3 -2 l-3.2 2 Z" fill="var(--surface)" {...ink} strokeLinejoin="round" /><path d="M47 38 h7 M47 43 h7" {...thin} /></g>;
    case 'pitchfork':
      return <g data-prop="pitchfork" fill="none" {...ink}><path d="M50 20 L50 54" strokeLinecap="round" /><path d="M43 22 L43 11 M50 20 L50 9 M57 22 L57 11 M43 22 h14" /></g>;
    case 'harp':
      return <g data-prop="harp"><path d="M43 53 C43 35 55 29 59 29 L59 53 Z" fill="none" {...ink} strokeLinejoin="round" /><path d="M48 52 L48 41 M52 52 L52 36 M56 52 L56 32" {...thin} /></g>;
    case 'wheel':
      return <g data-prop="wheel"><circle cx="49" cy="41" r="12" fill="none" {...ink} /><path d="M49 29 L49 53 M37 41 L61 41 M41 33 L57 49 M57 33 L41 49" {...thin} /><circle cx="49" cy="41" r="3" fill="var(--brass)" {...ink} /></g>;
    case 'briefcase':
      return <g data-prop="briefcase"><path d="M47 38 v-4 h8 v4" fill="none" {...ink} /><rect x="42" y="38" width="18" height="14" rx="2" fill="var(--surface-2)" {...ink} /><path d="M42 44 h18" {...thin} /></g>;
    case 'box':
      return <g data-prop="box"><path d="M42 40 l4 -6 h11 l4 6" fill="var(--surface-2)" {...ink} strokeLinejoin="round" /><rect x="42" y="40" width="19" height="13" fill="var(--brass)" {...ink} /><path d="M46 46 h5" {...thin} /></g>;
    case 'hymn':
      return <g data-prop="hymn"><rect x="41" y="35" width="19" height="18" rx="1" fill="var(--surface)" {...ink} /><path d="M50.5 35 v18" {...ink} /><path d="M44 40 h4 M53 40 h4 M44 45 h4 M53 45 h4" {...thin} /></g>;
    case 'scales':
      return <g data-prop="scales" fill="none" {...ink}><path d="M50 30 v22 M44 53 h12 M40 36 h20" strokeLinecap="round" /><path d="M36 38 h8 l-4 7 Z M56 38 h8 l-4 7 Z" strokeLinejoin="round" /></g>;
    case 'halos':
      return <g data-prop="halos"><path d="M50 28 v26" {...ink} strokeLinecap="round" /><ellipse cx="50" cy="35" rx="8" ry="2.4" fill="none" stroke="var(--brass)" strokeWidth={SW} /><ellipse cx="50" cy="42" rx="8" ry="2.4" fill="none" stroke="var(--brass)" strokeWidth={SW} /><ellipse cx="50" cy="49" rx="8" ry="2.4" fill="none" stroke="var(--brass)" strokeWidth={SW} /></g>;
    case 'fruit':
      return <g data-prop="fruit"><circle cx="46" cy="39" r="4.5" fill="var(--red)" {...ink} /><circle cx="56" cy="39" r="4.5" fill="var(--green)" {...ink} /><path d="M40 42 h22 l-2.5 11 h-17 Z" fill="var(--brass)" {...ink} strokeLinejoin="round" /></g>;
    case 'dice':
      return <g data-prop="dice"><rect x="41" y="40" width="12" height="12" rx="2" fill="var(--surface)" {...ink} /><rect x="51" y="32" width="11" height="11" rx="2" fill="var(--surface-2)" {...ink} /><g fill={OUTLINE}><circle cx="44.5" cy="43.5" r="1.4" /><circle cx="49.5" cy="48.5" r="1.4" /><circle cx="56.5" cy="37.5" r="1.4" /></g></g>;
    case 'flame':
      return <path data-prop="flame" d="M48 53 C40 45 48 42 46 33 C52 37 57 31 56 34 C61 42 58 53 50 53 Z" fill={FIRE} {...ink} strokeLinejoin="round" />;
    case 'stamp':
      return <g data-prop="stamp"><rect x="42" y="47" width="17" height="6" rx="1.5" fill="var(--surface-2)" {...ink} /><rect x="47" y="38" width="7" height="9" rx="1.5" fill="var(--red)" {...ink} /><rect x="45" y="33" width="11" height="5" rx="2.5" fill={OUTLINE} /></g>;
    default:
      return <path data-prop="lotus" d="M50 53 C43 53 39 46 39 41 C44 41 47 45 48 49 C45 42 48 35 50 32 C52 35 55 42 52 49 C53 45 56 41 61 41 C61 46 57 53 50 53 Z" fill="var(--violet)" {...ink} strokeLinejoin="round" />;
  }
}

function ShapePart({ kind, mood }: { kind: Shape; mood: Mood }) {
  switch (kind) {
    case 'dog':
      return (
        <g data-shape="dog">
          <path d="M20 26 C13 14 21 12 25 20 Z M44 26 C51 14 43 12 39 20 Z" fill={GOLD} {...ink} strokeLinejoin="round" />
          <path d="M14 54 L14 48 C14 43 50 43 50 48 L50 54 Z" fill="var(--teal)" {...ink} />
          <circle cx="32" cy="27" r="14" fill={GOLD} {...ink} />
          <ellipse cx="32" cy="36" rx="9" ry="6" fill="var(--surface)" {...ink} />
          <ellipse cx="32" cy="31" rx="2.6" ry="2" fill={OUTLINE} />
          <Face mood={mood} cx={32} cy={23} />
        </g>
      );
    case 'stapler':
      return (
        <g data-shape="stapler">
          <path d="M8 46 h48 v8 h-48 Z" fill="var(--surface-2)" {...ink} />
          <path d="M8 28 h44 c6 0 6 14 0 14 h-44 Z" fill="var(--red)" {...ink} strokeLinejoin="round" />
          <path d="M12 42 v4 M48 42 v4" {...ink} />
          <Face mood={mood} cx={27} cy={33} />
        </g>
      );
    case 'cabinet':
      return (
        <g data-shape="cabinet">
          <rect x="13" y="7" width="38" height="50" rx="2" fill="var(--surface-2)" {...ink} />
          <path d="M13 25 h38 M13 41 h38" {...ink} />
          <rect x="27" y="31" width="10" height="3.5" rx="1.75" fill={OUTLINE} />
          <rect x="27" y="47" width="10" height="3.5" rx="1.75" fill={OUTLINE} />
          <Face mood={mood} cx={32} cy={14} />
        </g>
      );
    default:
      return (
        <g data-shape="halos">
          <ellipse cx="12" cy="32" rx="9" ry="12" fill="none" stroke="var(--brass)" strokeWidth={SW} />
          <ellipse cx="52" cy="32" rx="9" ry="12" fill="none" stroke="var(--brass)" strokeWidth={SW} />
          <ellipse cx="32" cy="32" rx="9" ry="12" fill="none" stroke="var(--brass)" strokeWidth={SW} />
          <Face mood={mood} cx={32} cy={29} />
        </g>
      );
  }
}

function Portrait({ parts, mood }: { parts: Parts; mood: Mood }) {
  if (parts.shape) {
    return (
      <>
        <ShapePart kind={parts.shape} mood={mood} />
        {parts.head?.map((h) => <HeadPart key={h} kind={h} />)}
      </>
    );
  }
  return (
    <>
      {parts.head?.includes('wings') && <HeadPart kind="wings" />}
      <BodyPart kind={parts.body ?? 'blazer'} fill={parts.fill ?? 'var(--surface-2)'} />
      {parts.body !== 'sheet' && <circle cx="32" cy="21" r="11" fill="var(--surface)" {...ink} />}
      {parts.hair && <HairPart kind={parts.hair} fill={parts.hairFill ?? OUTLINE} />}
      {parts.head?.filter((h) => h !== 'wings').map((h) => <HeadPart key={h} kind={h} />)}
      <Face mood={mood} cx={32} cy={parts.body === 'sheet' ? 26 : 21} />
      {parts.face && <FaceExtraPart kind={parts.face} />}
      {parts.prop && <PropPart kind={parts.prop} />}
    </>
  );
}

// One row per card in src/data/cards.json; each card's `character` is its own id.
const PORTRAITS: Record<string, Parts> = {
  'c-dave-overtime': { body: 'hood', fill: 'var(--green)', prop: 'scythe' },
  'c-seraphine-chipper': { fill: 'var(--teal)', head: ['wings', 'halo'], face: 'blush' },
  'c-gary-break': { body: 'hood', fill: 'var(--red)', head: ['horns'], prop: 'coffee' },
  'c-cherub-choir': { body: 'cloud', fill: 'var(--surface)', head: ['halo'], face: 'blush', prop: 'hymn' },
  'c-imp-qa': { fill: 'var(--red)', head: ['horns'], prop: 'clipboard' },
  'c-clerk-karma': { fill: 'var(--brass)', hair: 'grey', prop: 'scales' },
  'c-archivist-dust': { body: 'robe', fill: 'var(--violet)', hair: 'grey', hairFill: 'var(--surface-2)', prop: 'box' },
  'c-temp-stapler': { shape: 'stapler' },
  'c-temp-voucher': { fill: 'var(--green)', hair: 'spiky', prop: 'receipts' },
  'c-temp-night': { body: 'robe', fill: 'var(--violet)', hair: 'spiky', head: ['headset'], prop: 'coffee' },

  'c-petra-keys': { body: 'robe', fill: 'var(--teal)', hair: 'bun', hairFill: 'var(--surface-2)', head: ['halo'], prop: 'keys' },
  'c-malphas-forks': { fill: 'var(--red)', head: ['horns'], face: 'moustache', prop: 'pitchfork' },
  'c-pemberton': { shape: 'dog', head: ['cap'] },
  'c-ferro': { fill: 'var(--violet)', hair: 'bun', face: 'glasses', prop: 'halos' },
  'c-auditor-fruit': { fill: 'var(--brass)', face: 'shades', prop: 'fruit' },
  'c-harpist-hold': { body: 'robe', fill: 'var(--teal)', head: ['wings', 'halo'], prop: 'harp' },
  'c-lilith-culture': { fill: 'var(--violet)', head: ['horns'], face: 'glasses', prop: 'clipboard' },
  'c-nadia-odds': { fill: 'var(--teal)', hair: 'grey', face: 'glasses', prop: 'dice' },
  'c-forgot': { body: 'sheet', fill: 'var(--surface)', prop: 'coffee' },

  'c-bev-wings': { fill: 'var(--teal)', hair: 'grey', hairFill: 'var(--surface-2)', head: ['wings', 'halo'], prop: 'clipboard' },
  'c-grax-fire': { fill: 'var(--red)', head: ['hardhat', 'horns'], prop: 'flame' },
  'c-wheel-tech': { fill: 'var(--brass)', head: ['hardhat'], prop: 'wheel' },
  'c-obroin': { body: 'robe', fill: 'var(--violet)', hair: 'grey', hairFill: 'var(--surface-2)', face: 'moustache', prop: 'stamp' },
  'c-dave-cooked': { body: 'hood', fill: 'var(--green)', face: 'shades', prop: 'coffee' },
  'c-grandma-liu': { fill: PINK, hair: 'bun', hairFill: 'var(--surface-2)', face: 'blush', prop: 'tray' },

  'c-seraph-board': { shape: 'halos' },
  'c-duke-vassago': { body: 'robe', fill: 'var(--red)', head: ['horns', 'crown'], prop: 'briefcase' },
  'c-bodhisattva': { body: 'robe', fill: 'var(--brass)', head: ['halo'], prop: 'lotus' },
  'c-keeper': { shape: 'cabinet' },
  'c-auditor-true': { fill: 'var(--surface-2)', face: 'shades', prop: 'briefcase' },
};

export function Character({ id, mood, size = 56 }: { id: string; mood: Mood; size?: number }) {
  const parts = PORTRAITS[id];
  if (parts) {
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} data-character={id} data-mood={mood} aria-hidden="true">
        <Portrait parts={parts} mood={mood} />
      </svg>
    );
  }
  const [arch, variantStr] = id.split(':');
  const Arch = ARCHETYPES[arch];
  if (Arch) {
    // Floor first: a fractional id like 'angel:2.7' must pick accessory 2, not index into thin air.
    const variant = Math.min(ACCESSORIES.length - 1, Math.max(0, Math.floor(Number(variantStr ?? 0) || 0)));
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
