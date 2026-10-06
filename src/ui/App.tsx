import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { t } from '../i18n';
import { useGame } from '../store/game';
import { useTestAds } from '../platform/adUnits';
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
import { Intro } from './overlays/Intro';
import { Training } from './overlays/Training';
import { Tips } from './overlays/Tips';
import { AchievementToast } from './components/AchievementToast';
import { Visitor } from './components/Visitor';
import { VisitorGift } from './overlays/VisitorGift';
import { SettingsSheet } from './overlays/SettingsSheet';
import { NotifPrompt } from './overlays/NotifPrompt';
import { SaveCodeSheet } from './overlays/SaveCodeSheet';
import { CloudNotice } from './components/CloudNotice';
import { TitleScreen } from './screens/TitleScreen';
import { Splash } from './screens/Splash';
import { EventScreen } from './screens/EventScreen';

export function App() {
  const [tab, setTab] = useState<TabId | 'event'>('office');
  // Every cold boot opens on the Inata Sun Soft splash, then the title screen: the title is
  // where the Play Games sign-in lives, and the sync it runs has to finish before the office
  // shows a desk that may be about to change.
  const [phase, setPhase] = useState<'splash' | 'title' | 'game'>('splash');
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

  // Web Audio may only start from a user gesture, and a gesture the WebView does not count
  // leaves the context suspended -- so every gesture keeps trying until the context says it
  // is running, and only then do the listeners come off.
  useEffect(() => {
    const events = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
    const unlock = () => {
      const { audio } = useGame.getState();
      audio.unlock();
      if (audio.isRunning()) events.forEach((e) => window.removeEventListener(e, unlock));
    };
    events.forEach((e) => window.addEventListener(e, unlock));
    return () => events.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  // Dev/test-ads builds only: `?music=<themeId>` forces that music theme on the office screen
  // so a theme can be auditioned without waiting for its event.
  useEffect(() => {
    if (!useTestAds()) return;
    const id = new URLSearchParams(window.location.search).get('music');
    if (id) useGame.getState().audio.setMusicTheme(id);
  }, []);

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
      {/* boot() runs underneath regardless of phase; the splash is a pure overlay, not a gate on it. */}
      {phase === 'splash' && <Splash onDone={() => setPhase('title')} />}
      {phase !== 'splash' && !ready && <section className="screen"><h2>{t('app.opening')}</h2></section>}
      {phase !== 'splash' && ready && phase === 'title' && <TitleScreen onEnter={() => setPhase('game')} onGoToOdds={onGoToOdds} />}
      {/* The whole office, overlays included: a ceremony or a prompt over the title screen
          would be a dialog about a desk the player has not sat down at yet. */}
      {ready && phase === 'game' && (
        <>
          {tab === 'office' && <OfficeScreen onSettings={openSettings} onGoTo={setTab} onOpenEvent={() => setTab('event')} />}
          {tab === 'event' && <EventScreen onBack={() => setTab('office')} />}
          {tab === 'personnel' && <PersonnelScreen onSettings={openSettings} />}
          {tab === 'ledger' && <LedgerScreen onSettings={openSettings} />}
          {tab === 'tasks' && <TasksScreen onSettings={openSettings} />}
          {tab === 'store' && <StoreScreen onSettings={openSettings} />}
          <CloudNotice />
          <BacklogReport />
          <AuditCeremony />
          <CosmicCeremony />
          <PullReveal />
          {tab === 'office' && <Visitor />}
          <VisitorGift />
          <Intro />
          <Training />
          <Tips tab={tab === 'event' ? 'office' : tab} />
          <AchievementToast />
          <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} onGoToOdds={onGoToOdds} onSaveCode={onSaveCode} />
          <SaveCodeSheet open={saveCodeOpen} onClose={() => setSaveCodeOpen(false)} />
          {/* The opening cutscene is the one overlay allowed to be the first thing a new
              player sees; a permission prompt on top of it would be the second. */}
          {memosSeen && !settingsOpen && !saveCodeOpen && <NotifPrompt />}
          <TabBar active={tab === 'event' ? 'office' : tab} onChange={setTab} />
        </>
      )}
    </div>
  );
}
