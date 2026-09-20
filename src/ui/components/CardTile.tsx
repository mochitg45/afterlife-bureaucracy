import type { CardDef } from '../../engine/content';
import { Character } from '../characters/Character';
import { DUPES_PER_STAR, MAX_STARS } from '../../engine/gacha';

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
}

/** A single personnel card: portrait, name, rarity and (if owned) star rank. Unowned cards show
 * the blank "soul" silhouette instead of the card's own character, since the player hasn't met them yet. */
export function CardTile({ card, stars, owned, equipped = false, onClick, shards }: CardTileProps) {
  const classes = ['tile', `rarity-${card.rarity}`, owned ? 'owned' : 'locked'];
  if (equipped) classes.push('equipped');
  return (
    <button type="button" className={classes.join(' ')} onClick={onClick} aria-label={`${card.name}, ${card.title}`}>
      <Character id={owned ? card.character : 'soul'} mood="ok" size={48} />
      <span className="tile-name">{card.name}</span>
      <span className="tile-rarity sub">{RARITY_LABEL[card.rarity]}</span>
      {owned && (
        <span className="tile-stars mono" aria-label={`${stars} stars`}>
          {'★'.repeat(Math.max(0, stars))}
        </span>
      )}
      {owned && shards !== undefined && stars < MAX_STARS && stars >= 1 && (
        <span className="tile-shards sub">{shards}/{DUPES_PER_STAR[stars - 1]}</span>
      )}
    </button>
  );
}
