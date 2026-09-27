import type { CardDef } from '../../engine/content';
import { Character } from '../characters/Character';
import { dupesForNextStar, MAX_STARS } from '../../engine/gacha';
import { Stars } from './Stars';

/** Shared with PersonnelScreen's Odds card so the two never drift apart. */
export const RARITY_LABEL: Record<CardDef['rarity'], string> = {
  temp: 'Temp',
  fulltime: 'Full-Time',
  senior: 'Senior Staff',
  executive: 'Executive',
};

export interface CardTileProps {
  card: CardDef;
  /** Star rank to display when owned; ignored otherwise. */
  stars: number;
  owned: boolean;
  equipped?: boolean;
  onClick?: () => void;
  /** Shards banked toward the next star; omitted or at ★5, no progress line shows. */
  shards?: number;
  /** Portrait size in px; the 10-pull grid shrinks it so ten cards fit one phone screen. */
  size?: number;
}

/** A single personnel card: portrait, name, rarity and (if owned) star rank. Unowned cards show
 * the blank "soul" silhouette instead of the card's own character, since the player hasn't met them yet. */
export function CardTile({ card, stars, owned, equipped = false, onClick, shards, size = 48 }: CardTileProps) {
  const classes = ['tile', `rarity-${card.rarity}`, owned ? 'owned' : 'locked'];
  if (equipped) classes.push('equipped');
  return (
    <button type="button" className={classes.join(' ')} onClick={onClick} aria-label={`${card.name}, ${card.title}`}>
      <Character id={owned ? card.character : 'soul'} art={owned ? card.id : undefined} mood="ok" size={size} />
      <span className="tile-name">{card.name}</span>
      <span className="tile-rarity sub">{RARITY_LABEL[card.rarity]}</span>
      <Stars stars={owned ? stars : 0} className="tile-stars" />
      {owned && shards !== undefined && stars < MAX_STARS && stars >= 1 && (
        <span className="tile-shards sub">{shards}/{dupesForNextStar(card.rarity, stars)}</span>
      )}
    </button>
  );
}
