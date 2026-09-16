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
import { OnboardingMemos } from './overlays/OnboardingMemos';
import { Training } from './overlays/Training';
import { AchievementToast } from './components/AchievementToast';
import { SettingsSheet } from './overlays/SettingsSheet';
import { NotifPrompt } from './overlays/NotifPrompt';
import { SaveCodeSheet } from './overlays/SaveCodeSheet';
import { CloudNotice } from './components/CloudNotice';
import { TitleScreen } from './screens/TitleScreen';

export function App() {
  const [tab, setTab] = useState<TabId>('office');
  // Every cold boot opens on the title screen: it is where the Play Games sign-in lives, and
  // the sync it runs has to finish before the office shows a desk that may be about to change.
  const [phase, setPhase] = useState<'title' | 'game'>('title');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveCodeOpen, setSaveCodeOpen] = useState(false);
  const openSettings = () => setSettingsOpen(true);
  const onGoToOdds = () => {
    setTab('personnel');
    setSettingsOpen(false);
    setPhase('game');
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
  const memosSeen = useGame((s) => s.state.onboarding.memosSeen);

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
      {ready && phase === 'title' && <TitleScreen onEnter={() => setPhase('game')} onGoToOdds={onGoToOdds} />}
      {/* The whole office, overlays included: a ceremony or a prompt over the title screen
          would be a dialog about a desk the player has not sat down at yet. */}
      {ready && phase === 'game' && (
        <>
          {tab === 'office' && <OfficeScreen onSettings={openSettings} />}
          {tab === 'personnel' && <PersonnelScreen onSettings={openSettings} />}
          {tab === 'ledger' && <LedgerScreen onSettings={openSettings} />}
          {tab === 'tasks' && <TasksScreen onSettings={openSettings} />}
          {tab === 'store' && <StoreScreen onSettings={openSettings} />}
          <CloudNotice />
          <BacklogReport />
          <AuditCeremony />
          <CosmicCeremony />
          <PullReveal />
          <StoryMemo />
          <OnboardingMemos />
          <Training />
          <AchievementToast />
          <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} onGoToOdds={onGoToOdds} onSaveCode={onSaveCode} />
          <SaveCodeSheet open={saveCodeOpen} onClose={() => setSaveCodeOpen(false)} />
          {/* The first-launch memos are the one overlay allowed to be the first thing a new
              player reads; a permission prompt on top of them would be the second. */}
          {memosSeen && !settingsOpen && !saveCodeOpen && <NotifPrompt />}
          <TabBar active={tab} onChange={setTab} />
        </>
      )}
    </div>
  );
}
