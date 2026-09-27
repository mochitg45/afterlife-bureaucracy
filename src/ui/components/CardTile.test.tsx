import { render, screen } from '@testing-library/react';
import { CardTile } from './CardTile';
import { content } from '../../data';

const card = content.cards[0];

describe('CardTile stars', () => {
  it('shows 2 of 5 filled stars for an owned ★2 card', () => {
    render(<CardTile card={card} stars={2} owned />);
    const stars = screen.getByLabelText('2 of 5 stars');
    expect(stars).toBeInTheDocument();
    expect(stars.querySelector('.stars-filled')?.textContent).toBe('★★');
    expect(stars.querySelector('.stars-empty')?.textContent).toBe('☆☆☆');
  });

  it('shows 0 of 5 stars, all empty, for an unowned card', () => {
    render(<CardTile card={card} stars={0} owned={false} />);
    const stars = screen.getByLabelText('0 of 5 stars');
    expect(stars.querySelector('.stars-filled')?.textContent).toBe('');
    expect(stars.querySelector('.stars-empty')?.textContent).toBe('☆☆☆☆☆');
  });

  it('ignores a passed-in star count for an unowned card (still 0 of 5)', () => {
    render(<CardTile card={card} stars={3} owned={false} />);
    expect(screen.getByLabelText('0 of 5 stars')).toBeInTheDocument();
  });
});
