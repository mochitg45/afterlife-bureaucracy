import type { ReactElement } from 'react';

export type TabId = 'office' | 'personnel' | 'ledger' | 'tasks' | 'store';

const TABS: Array<{ id: TabId; label: string; icon: ReactElement }> = [
  { id: 'office', label: 'Office', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V4h8v3" /></svg> },
  { id: 'personnel', label: 'Personnel', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg> },
  { id: 'ledger', label: 'Ledger', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3h14v18H5z" /><path d="M9 8h6M9 12h6M9 16h4" /></svg> },
  { id: 'tasks', label: 'Tasks', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6l2 2 4-4M4 12l2 2 4-4M4 18l2 2 4-4M13 6h7M13 12h7M13 18h7" /></svg> },
  { id: 'store', label: 'Store', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l1-5h16l1 5M3 9h18v11H3z" /><path d="M9 20v-6h6v6" /></svg> },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <nav className="tabbar" role="tablist" aria-label="Main">
      {TABS.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} aria-label={t.label} onClick={() => onChange(t.id)}>
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
