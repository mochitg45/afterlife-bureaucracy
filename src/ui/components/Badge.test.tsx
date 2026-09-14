import { render } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('sets data attributes for kind and tier', () => {
    const { container } = render(<Badge kind="trophy" tier={3} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-kind', 'trophy');
    expect(svg).toHaveAttribute('data-tier', '3');
    expect(svg).toHaveAttribute('data-locked', 'false');
  });

  it('dims and desaturates when locked', () => {
    const { container } = render(<Badge kind="star" tier={1} locked />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-locked', 'true');
    expect(svg).toHaveStyle({ opacity: '0.35' });
  });

  it('renders at 64x64 by default and honors a custom size', () => {
    const { container } = render(<Badge kind="gear" tier={2} />);
    let svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '64');
    expect(svg).toHaveAttribute('height', '64');

    const { container: c2 } = render(<Badge kind="gear" tier={2} size={32} />);
    svg = c2.querySelector('svg');
    expect(svg).toHaveAttribute('width', '32');
  });

  it('renders every glyph kind with at most 12 elements', () => {
    const kinds = ['stamp', 'trophy', 'star', 'scroll', 'flame', 'gear'] as const;
    for (const kind of kinds) {
      const { container } = render(<Badge kind={kind} tier={1} />);
      const svg = container.querySelector('svg')!;
      expect(svg.querySelectorAll('*').length).toBeLessThanOrEqual(12);
    }
  });
});
