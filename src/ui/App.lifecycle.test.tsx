import { render, act } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from './App';
import { useGame } from '../store/game';

const addListenerMock = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));

vi.mock('@capacitor/app', () => ({
  App: { addListener: (...args: unknown[]) => addListenerMock(...args) },
}));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

describe('App lifecycle', () => {
  let originalDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    addListenerMock.mockReset();
  });

  afterEach(() => {
    if (originalDescriptor) Object.defineProperty(document, 'visibilityState', originalDescriptor);
    else delete (document as unknown as Record<string, unknown>).visibilityState;
  });

  it('saves on hidden, boots on visible via visibilitychange', async () => {
    let resolveHandle: (h: { remove(): void }) => void = () => {};
    addListenerMock.mockReturnValue(new Promise<{ remove(): void }>((resolve) => { resolveHandle = resolve; }));
    const save = vi.fn().mockResolvedValue(undefined);
    const boot = vi.fn().mockResolvedValue(undefined);
    useGame.setState({ save, boot, ready: true });

    render(<App />);
    await act(async () => { resolveHandle({ remove: vi.fn() }); });
    boot.mockClear();

    setVisibility('hidden');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(save).toHaveBeenCalled();

    setVisibility('visible');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(boot).toHaveBeenCalled();
  });

  it('stops reacting to visibilitychange after unmount', async () => {
    let resolveHandle: (h: { remove(): void }) => void = () => {};
    addListenerMock.mockReturnValue(new Promise<{ remove(): void }>((resolve) => { resolveHandle = resolve; }));
    const save = vi.fn().mockResolvedValue(undefined);
    const boot = vi.fn().mockResolvedValue(undefined);
    useGame.setState({ save, boot, ready: true });

    const { unmount } = render(<App />);
    await act(async () => { resolveHandle({ remove: vi.fn() }); });
    unmount();
    save.mockClear();
    boot.mockClear();

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(save).not.toHaveBeenCalled();

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(boot).not.toHaveBeenCalled();
  });

  it('removes the native listener handle even when unmounted before registration resolves', async () => {
    let resolveHandle: (h: { remove(): void }) => void = () => {};
    addListenerMock.mockReturnValue(new Promise<{ remove(): void }>((resolve) => { resolveHandle = resolve; }));
    const save = vi.fn().mockResolvedValue(undefined);
    const boot = vi.fn().mockResolvedValue(undefined);
    useGame.setState({ save, boot, ready: true });

    const { unmount } = render(<App />);
    unmount();
    const remove = vi.fn();
    await act(async () => { resolveHandle({ remove }); });

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
