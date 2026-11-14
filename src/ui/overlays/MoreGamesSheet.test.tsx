import { render, screen, fireEvent } from '@testing-library/react';
import { MoreGamesSheet, MORE_GAMES } from './MoreGamesSheet';

describe('MoreGamesSheet', () => {
  it('lists every other app with a tagged Play link, never Afterlife itself', () => {
    const onClose = vi.fn();
    render(<MoreGamesSheet onClose={onClose} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(MORE_GAMES.length);
    expect(links.some((a) => a.getAttribute('href')!.includes('afterlifebureaucracy'))).toBe(false);
    const decant = screen.getByRole('link', { name: 'Get Decant on Google Play' });
    expect(decant.getAttribute('href')).toBe(
      'https://play.google.com/store/apps/details?id=com.sortlab.watersortpuzzle&referrer=utm_source%3Dafterlife%26utm_medium%3Dmore_games',
    );
    expect(screen.getByText('Sort the colors, pour by pour.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
