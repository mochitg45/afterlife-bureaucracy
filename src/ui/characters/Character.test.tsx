import { render } from '@testing-library/react';
import { Character } from './Character';
import cards from '../../data/cards.json';

describe('Character', () => {
  it('renders each known character with a mood attribute', () => {
    for (const id of ['dave', 'seraphine', 'gary', 'auditor'] as const) {
      const { container, unmount } = render(<Character id={id} mood="ok" />);
      const svg = container.querySelector('svg')!;
      expect(svg).toBeInTheDocument();
      expect(svg.getAttribute('data-mood')).toBe('ok');
      expect(svg.getAttribute('data-character')).toBe(id);
      unmount();
    }
  });
  it('changes face group when cooked', () => {
    const ok = render(<Character id="dave" mood="ok" />).container.querySelector('[data-face]')!.getAttribute('data-face');
    const cooked = render(<Character id="dave" mood="cooked" />).container.querySelector('[data-face]')!.getAttribute('data-face');
    expect(ok).toBe('ok');
    expect(cooked).toBe('cooked');
  });
  it('falls back to a soul silhouette for unknown ids', () => {
    const { container } = render(<Character id="whoever" mood="ok" />);
    expect(container.querySelector('svg')!.getAttribute('data-character')).toBe('soul');
  });
  it('renders archetype variants with accessories', () => {
    for (const arch of ['angel', 'demon', 'clerk', 'archivist']) {
      const { container, unmount } = render(<Character id={`${arch}:3`} mood="ok" />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('data-character')).toBe(arch);
      expect(svg.getAttribute('data-variant')).toBe('3');
      expect(svg.querySelector('[data-accessory="clipboard"]')).not.toBeNull();
      unmount();
    }
  });
  it('floors a fractional variant instead of landing between accessories', () => {
    const { container } = render(<Character id="angel:2.7" mood="ok" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('data-variant')).toBe('2');
    expect(svg.querySelector('[data-accessory="tie"]')).not.toBeNull();
  });
  it('clamps a variant past the end of the accessory list', () => {
    const { container } = render(<Character id="angel:99" mood="ok" />);
    expect(container.querySelector('svg')!.getAttribute('data-variant')).toBe('4');
  });

  it('gives every card its own portrait, keyed by its own id', () => {
    const markup = new Set<string>();
    for (const card of cards as { id: string; character: string }[]) {
      const { container, unmount } = render(<Character id={card.character} mood="ok" />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('data-character')).toBe(card.id);
      markup.add(svg.outerHTML);
      unmount();
    }
    expect(markup.size).toBe(cards.length);
  });
});
