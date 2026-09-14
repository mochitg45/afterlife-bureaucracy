import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useGame } from '../store/game';
import { TabBar, type TabId } from './components/TabBar';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { OfficeScreen } from './screens/OfficeScreen';
import { LedgerScreen } from './screens/LedgerScreen';
import { PersonnelScreen } from './screens/PersonnelScreen';
import { BacklogReport } from './overlays/BacklogReport';
import { AuditCeremony } from './overlays/AuditCeremony';
import { PullReveal } from './overlays/PullReveal';

export function App() {
  const [tab, setTab] = useState<TabId>('office');
  const boot = useGame((s) => s.boot);
  const pause = useGame((s) => s.pause);
  const resume = useGame((s) => s.resume);
  const stopLoop = useGame((s) => s.stopLoop);
  const ready = useGame((s) => s.ready);

  useEffect(() => { void boot(); }, [boot]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void pause();
      else void resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    let handle: { remove(): Promise<void> } | null = null;
    let cancelled = false;
    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void resume(); else void pause(); }).then((h) => {
        if (cancelled) void h.remove();
        else handle = h;
      });
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      cancelled = true;
      void handle?.remove();
      stopLoop();
    };
  }, [pause, resume, stopLoop]);

  return (
    <div className="app safe-area">
      {!ready && <section className="screen"><h2>Opening the office…</h2></section>}
      {ready && tab === 'office' && <OfficeScreen />}
      {ready && tab === 'personnel' && <PersonnelScreen />}
      {ready && tab === 'ledger' && <LedgerScreen />}
      {ready && tab === 'tasks' && <PlaceholderScreen title="Tasks" note="Daily tasks and achievements open in a later update." />}
      {ready && tab === 'store' && <PlaceholderScreen title="Store" note="Requisition Vouchers store opens in a later update." />}
      <BacklogReport />
      <AuditCeremony />
      <PullReveal />
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
