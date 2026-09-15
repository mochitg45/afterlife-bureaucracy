import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useGame } from '../store/game';
import { TabBar, type TabId } from './components/TabBar';
import { OfficeScreen } from './screens/OfficeScreen';
import { LedgerScreen } from './screens/LedgerScreen';
import { PersonnelScreen } from './screens/PersonnelScreen';
import { TasksScreen } from './screens/TasksScreen';
import { StoreScreen } from './screens/StoreScreen';
import { BacklogReport } from './overlays/BacklogReport';
import { AuditCeremony } from './overlays/AuditCeremony';
import { CosmicCeremony } from './overlays/CosmicCeremony';
import { PullReveal } from './overlays/PullReveal';
import { StoryMemo } from './overlays/StoryMemo';
import { AchievementToast } from './components/AchievementToast';
import { SettingsSheet } from './overlays/SettingsSheet';
import { NotifPrompt } from './overlays/NotifPrompt';
import { SaveCodeSheet } from './overlays/SaveCodeSheet';

export function App() {
  const [tab, setTab] = useState<TabId>('office');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveCodeOpen, setSaveCodeOpen] = useState(false);
  const openSettings = () => setSettingsOpen(true);
  const onGoToOdds = () => {
    setTab('personnel');
    setSettingsOpen(false);
  };
  // One sheet at a time: two stacked dialogs would leave two focus traps fighting over Tab.
  const onSaveCode = () => {
    setSettingsOpen(false);
    setSaveCodeOpen(true);
  };
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
      {ready && tab === 'office' && <OfficeScreen onSettings={openSettings} />}
      {ready && tab === 'personnel' && <PersonnelScreen onSettings={openSettings} />}
      {ready && tab === 'ledger' && <LedgerScreen onSettings={openSettings} />}
      {ready && tab === 'tasks' && <TasksScreen onSettings={openSettings} />}
      {ready && tab === 'store' && <StoreScreen onSettings={openSettings} />}
      <BacklogReport />
      <AuditCeremony />
      <CosmicCeremony />
      <PullReveal />
      <StoryMemo />
      <AchievementToast />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} onGoToOdds={onGoToOdds} onSaveCode={onSaveCode} />
      <SaveCodeSheet open={saveCodeOpen} onClose={() => setSaveCodeOpen(false)} />
      {!settingsOpen && !saveCodeOpen && <NotifPrompt />}
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
