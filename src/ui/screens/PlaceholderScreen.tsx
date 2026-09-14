export function PlaceholderScreen({ title, note }: { title: string; note: string }) {
  return (
    <section className="screen">
      <h2>{title}</h2>
      <p style={{ color: 'var(--ink-muted)' }}>{note}</p>
    </section>
  );
}
