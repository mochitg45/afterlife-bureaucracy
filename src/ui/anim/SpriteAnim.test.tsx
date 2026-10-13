import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { SpriteAnim } from './SpriteAnim';
import { ANIMS } from './manifest';

class FakeImage {
  onload: () => void = () => {};
  onerror: () => void = () => {};
  set src(v: string) { queueMicrotask(() => (v.includes('/bad/') ? this.onerror() : this.onload())); }
}

const frame = (c: HTMLElement) => c.querySelector('img')?.getAttribute('src')?.match(/([a-z]+_\d+)\.webp$/)?.[1];
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
const tickMs = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('Image', FakeImage);
  ANIMS.t1 = { work: 4, happy: 2 };
  ANIMS.bad = { work: 2 };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); delete ANIMS.t1; delete ANIMS.bad; });

describe('SpriteAnim', () => {
  it('loops frames on the shared clock', async () => {
    const { container } = render(<SpriteAnim id="t1" />);
    expect(frame(container)).toBe('work_0');
    await flush();
    const seen = new Set<string | undefined>();
    for (let i = 0; i < 4; i++) { await tickMs(100); seen.add(frame(container)); }
    expect(seen.size).toBe(4);
  });

  it('plays a reaction once, then returns to the loop', async () => {
    const end = vi.fn();
    const { container, rerender } = render(<SpriteAnim id="t1" onReactionEnd={end} />);
    await flush();
    rerender(<SpriteAnim id="t1" onReactionEnd={end} reaction={{ clip: 'happy', key: 1 }} />);
    await flush();
    expect(frame(container)).toBe('happy_0');
    await tickMs(200);
    expect(frame(container)).toBe('happy_1');
    expect(end).not.toHaveBeenCalled();
    await tickMs(200);
    expect(end).toHaveBeenCalledTimes(1);
    expect(frame(container)).toMatch(/^work_/);
  });

  it('ends immediately for a clip the character does not have', async () => {
    const end = vi.fn();
    const { container, rerender } = render(<SpriteAnim id="t1" onReactionEnd={end} />);
    await flush();
    rerender(<SpriteAnim id="t1" onReactionEnd={end} reaction={{ clip: 'true', key: 1 }} />);
    expect(end).toHaveBeenCalledTimes(1);
    expect(frame(container)).toMatch(/^work_/);
  });

  it('shows the fallback when the clip is absent or fails to load', async () => {
    const a = render(<SpriteAnim id="nobody" fallback={<b data-fb />} />);
    expect(a.container.querySelector('[data-fb]')).not.toBeNull();
    const b = render(<SpriteAnim id="bad" fallback={<b data-fb />} />);
    await flush();
    expect(b.container.querySelector('[data-fb]')).not.toBeNull();
  });
});
