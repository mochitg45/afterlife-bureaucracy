import { render } from '@testing-library/react';
import { Character } from './Character';

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
});
