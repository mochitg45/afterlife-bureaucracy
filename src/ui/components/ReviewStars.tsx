const STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z';

/** Five drawn stars filled to `value` (0-5, fractions allowed). Decorative: the caller labels it. */
export function ReviewStars({ value, size = 14 }: { value: number; size?: number }) {
  const row = (cls: string) => (
    <span className={cls} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"><path d={STAR} /></svg>
      ))}
    </span>
  );
  const pct = Math.min(100, Math.max(0, (value / 5) * 100));
  return (
    <span className="rstars" style={{ ['--fill' as string]: `${pct}%` }}>
      {row('rstars-row rstars-bg')}
      {row('rstars-row rstars-fg')}
    </span>
  );
}
