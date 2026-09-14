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

/** Stub the lifecycle half of the store and hand back the spies. */
function stubStore() {
  const boot = vi.fn().mockResolvedValue(undefined);
  const pause = vi.fn().mockResolvedValue(undefined);
  const resume = vi.fn().mockResolvedValue(undefined);
  const stopLoop = vi.fn();
  useGame.setState({ boot, pause, resume, stopLoop, ready: true });
  return { boot, pause, resume, stopLoop };
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

  it('pauses on hidden and resumes on visible via visibilitychange', async () => {
    let resolveHandle: (h: { remove(): void }) => void = () => {};
    addListenerMock.mockReturnValue(new Promise<{ remove(): void }>((resolve) => { resolveHandle = resolve; }));
    const { boot, pause, resume } = stubStore();

    render(<App />);
    await act(async () => { resolveHandle({ remove: vi.fn() }); });
    expect(boot).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();

    setVisibility('visible');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('pauses and resumes on the native appStateChange event', async () => {
    let resolveHandle: (h: { remove(): void }) => void = () => {};
    addListenerMock.mockReturnValue(new Promise<{ remove(): void }>((resolve) => { resolveHandle = resolve; }));
    const { pause, resume } = stubStore();

    render(<App />);
    await act(async () => { resolveHandle({ remove: vi.fn() }); });

    const onAppState = addListenerMock.mock.calls[0][1] as (e: { isActive: boolean }) => void;
    await act(async () => { onAppState({ isActive: false }); });
    expect(pause).toHaveBeenCalledTimes(1);

    await act(async () => { onAppState({ isActive: true }); });
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('stops the loop and ignores visibilitychange after unmount', async () => {
    let resolveHandle: (h: { remove(): void }) => void = () => {};
    addListenerMock.mockReturnValue(new Promise<{ remove(): void }>((resolve) => { resolveHandle = resolve; }));
    const { pause, resume, stopLoop } = stubStore();

    const { unmount } = render(<App />);
    await act(async () => { resolveHandle({ remove: vi.fn() }); });
    unmount();
    expect(stopLoop).toHaveBeenCalledTimes(1);
    pause.mockClear();
    resume.mockClear();

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pause).not.toHaveBeenCalled();

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(resume).not.toHaveBeenCalled();
  });

  it('removes the native listener handle even when unmounted before registration resolves', async () => {
    let resolveHandle: (h: { remove(): void }) => void = () => {};
    addListenerMock.mockReturnValue(new Promise<{ remove(): void }>((resolve) => { resolveHandle = resolve; }));
    stubStore();

    const { unmount } = render(<App />);
    unmount();
    const remove = vi.fn();
    await act(async () => { resolveHandle({ remove }); });

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
