import { existsSync } from 'node:fs';
import { render } from '@testing-library/react';
import { Character } from './Character';
import { ART } from './art';

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
  it('renders a sprite img when art resolves to a known asset', () => {
    const { container } = render(<Character id="angel:0" art="h-cherub" mood="ok" size={52} />);
    const img = container.querySelector('img')!;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toMatch(/art\/chars\/choir-cherub\.webp$/);
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('width')).toBe('52');
    expect(img.getAttribute('height')).toBe('52');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('falls back to the SVG when the art key has no sprite', () => {
    const { container } = render(<Character id="angel:3" art="v-einherjar" mood="ok" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders the SVG as before when no art prop is given', () => {
    const { container } = render(<Character id="dave" mood="ok" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('points every ART entry at a sprite that exists in public/art/chars', () => {
    for (const name of Object.values(ART)) {
      expect(existsSync(`public/art/chars/${name}.webp`), name).toBe(true);
    }
  });
});
