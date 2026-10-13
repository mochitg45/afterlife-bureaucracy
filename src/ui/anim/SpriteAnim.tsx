import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ANIMS, animFrameUrl, type Clip } from './manifest';

/** One shared clock for every sprite: ticks at ~10 fps, runs only while someone listens. */
const TICK_MS = 100;
let tick = 0;
let timer: number | undefined;
const subs = new Set<(t: number) => void>();
function subscribe(fn: (t: number) => void) {
  subs.add(fn);
  if (timer === undefined) timer = window.setInterval(() => { tick++; subs.forEach((f) => f(tick)); }, TICK_MS);
  return () => {
    subs.delete(fn);
    if (!subs.size && timer !== undefined) { window.clearInterval(timer); timer = undefined; }
  };
}

const loads = new Map<string, Promise<boolean>>();
/** Resolves true once every frame of the clip is decoded-ready; false if the clip is missing or any frame fails. */
export function preloadClip(id: string, clip: Clip): Promise<boolean> {
  const n = ANIMS[id]?.[clip] ?? 0;
  if (!n) return Promise.resolve(false);
  const k = `${id}/${clip}/${n}`;
  let p = loads.get(k);
  if (!p) {
    p = Promise.all(Array.from({ length: n }, (_, i) => new Promise<boolean>((res) => {
      const im = new Image();
      im.onload = () => res(true);
      im.onerror = () => res(false);
      im.src = animFrameUrl(id, clip, i);
    }))).then((r) => r.every(Boolean));
    loads.set(k, p);
  }
  return p;
}

export interface Reaction { clip: Clip; key: number }

interface Props {
  id: string;
  /** Looping clip, default 'work'. */
  clip?: Clip;
  /** Frames to offset this sprite so a crew is never in sync. */
  phase?: number;
  /** Play this clip once (new key = new play), then return to the loop. */
  reaction?: Reaction | null;
  onReactionEnd?: () => void;
  /** Shown if the loop clip is missing or fails to load. */
  fallback?: ReactNode;
}

const reduced = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function SpriteAnim({ id, clip = 'work', phase = 0, reaction, onReactionEnd, fallback = null }: Props) {
  const n = ANIMS[id]?.[clip] ?? 0;
  const [status, setStatus] = useState<'loading' | 'ok' | 'failed'>(n ? 'loading' : 'failed');
  const [src, setSrc] = useState(n ? animFrameUrl(id, clip, 0) : '');
  const react = useRef<{ clip: Clip; n: number; start: number } | null>(null);
  const done = useRef(onReactionEnd);
  done.current = onReactionEnd;
  const still = useRef(reduced());

  useEffect(() => {
    let live = true;
    if (!n) { setStatus('failed'); return; }
    setStatus('loading');
    void preloadClip(id, clip).then((ok) => { if (live) setStatus(ok ? 'ok' : 'failed'); });
    return () => { live = false; };
  }, [id, clip, n]);

  useEffect(() => {
    if (status !== 'ok' || still.current) return;
    return subscribe((t) => {
      const r = react.current;
      if (r) {
        const i = t - r.start;
        if (i < r.n) { setSrc(animFrameUrl(id, r.clip, i)); return; }
        react.current = null;
        done.current?.();
      }
      setSrc(animFrameUrl(id, clip, (t + phase) % n));
    });
  }, [status, id, clip, n, phase]);

  useEffect(() => {
    if (!reaction) return;
    let live = true;
    const rn = ANIMS[id]?.[reaction.clip] ?? 0;
    const skip = () => done.current?.();
    if (!rn || still.current || status !== 'ok') { skip(); return; }
    void preloadClip(id, reaction.clip).then((ok) => {
      if (!live) return;
      if (!ok) { skip(); return; }
      react.current = { clip: reaction.clip, n: rn, start: tick + 1 };
      setSrc(animFrameUrl(id, reaction.clip, 0));
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reaction?.key]);

  if (status === 'failed') return <>{fallback}</>;
  return <img src={src} alt="" draggable={false} data-anim={id} />;
}
