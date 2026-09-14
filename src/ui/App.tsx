import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useGame } from '../store/game';
import { TabBar, type TabId } from './components/TabBar';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { OfficeScreen } from './screens/OfficeScreen';
import { BacklogReport } from './overlays/BacklogReport';

export function App() {
  const [tab, setTab] = useState<TabId>('office');
  const boot = useGame((s) => s.boot);
  const save = useGame((s) => s.save);
  const ready = useGame((s) => s.ready);

  useEffect(() => { void boot(); }, [boot]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void save();
      else void boot();
    };
    document.addEventListener('visibilitychange', onVisibility);
    let handle: { remove(): Promise<void> } | null = null;
    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void boot(); else void save(); }).then((h) => { handle = h; });
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void handle?.remove();
    };
  }, [boot, save]);

  return (
    <div className="app">
      {!ready && <section className="screen"><h2>Opening the office…</h2></section>}
      {ready && tab === 'office' && <OfficeScreen />}
      {ready && tab === 'personnel' && <PlaceholderScreen title="Personnel" note="Requisition Lottery opens in a later update." />}
      {ready && tab === 'ledger' && <PlaceholderScreen title="Ledger" note="Fiscal Year Audits open in a later update." />}
      {ready && tab === 'tasks' && <PlaceholderScreen title="Tasks" note="Daily tasks and achievements open in a later update." />}
      {ready && tab === 'store' && <PlaceholderScreen title="Store" note="Requisition Vouchers store opens in a later update." />}
      <BacklogReport />
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
