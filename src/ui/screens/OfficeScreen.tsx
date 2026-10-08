import { useEffect, useState, type CSSProperties } from 'react';
import { useGame, TRAINING_DONE } from '../../store/game';
import { content } from '../../data';
import { findDepartment } from '../../engine/content';
import type { BuyMode } from '../../engine/actions';
import { CurrencyBar } from '../components/CurrencyBar';
import { DeptChips } from '../components/DeptChips';
import { QueueCard } from '../components/QueueCard';
import { StampButton } from '../components/StampButton';
import { StaffRow } from '../components/StaffRow';
import { UpgradeRow } from '../components/UpgradeRow';
import { MemoTicker } from '../components/MemoTicker';
import { useWatchAd } from '../hooks/useWatchAd';
import { fmtLeft } from '../format';
import { EventBanner } from './EventScreen';
import { nextGoal, type GoalWhere } from '../../engine/goal';
import { t } from '../../i18n';

type GoalTab = Extract<GoalWhere, { kind: 'tab' }>['tab'];

/**
 * The one-line "Next:" hint for a player new to idle games. Selected as a string so the tick
 * loop re-renders it only when the advice changes. Tapping it goes to the tab it names, or
 * scrolls the Office control into view and flashes it.
 */
function NextGoal({ onGoTo }: { onGoTo?: (tab: GoalTab) => void }) {
  const trained = useGame((s) => s.state.onboarding.trainingStep >= TRAINING_DONE);
  const key = useGame((s) => JSON.stringify(nextGoal(s.state, content)));
  if (!trained) return null;
  const goal = JSON.parse(key) as ReturnType<typeof nextGoal>;
  const go = () => {
    const w = goal.where;
    if (!w) return;
    if (w.kind === 'tab') { onGoTo?.(w.tab); return; }
    const el = document.querySelector<HTMLElement>(w.selector);
    if (!el) return;
    el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    el.classList.remove('goal-flash');
    void el.offsetWidth; // restart the flash if it is tapped twice
    el.classList.add('goal-flash');
    setTimeout(() => el.classList.remove('goal-flash'), 1200);
  };
  return (
    <button type="button" className="next-goal" onClick={go} data-coach="next-goal">
      <span className="label mono">{t('office.next')}</span> <span>{goal.text}</span>
    </button>
  );
}

const MODES: BuyMode[] = [1, 10, 'max'];

/**
 * Rounded up to the minute so a countdown never reads "0h 0m" while there is still time on
 * it, and so the text only changes once a minute however often the tick fires.
 */
/**
 * The Overtime Boost placement: four hours of double output for one rewarded ad, then a
 * cooldown. Both the running boost and the cooldown tick down live, so the only self-driven
 * clock on the screen lives here — and only while there is something to count.
 */
function OvertimeBoost() {
  const boostUntilWall = useGame((s) => s.state.boostUntilWall);
  const cooldownUntilWall = useGame((s) => s.state.adState.boostCooldownUntilWall);
  const adsReady = useGame((s) => s.adsReady);
  const ready = useGame((s) => s.canWatch('overtime-boost'));
  const { busy, watch } = useWatchAd('overtime-boost');
  const [now, setNow] = useState(() => Date.now());

  const boostLeft = boostUntilWall - now;
  const cooldownLeft = cooldownUntilWall - now;
  const counting = boostLeft > 0 || cooldownLeft > 0;

  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  const note = boostLeft > 0
    ? t('office.boostLeft', { time: fmtLeft(boostLeft) })
    : cooldownLeft > 0
      ? t('office.availableIn', { time: fmtLeft(cooldownLeft) })
      : t('office.watchAd');

  return (
    <div className="card boost-card">
      <button className="btn btn-primary" aria-label={t('office.boostAria')} disabled={!ready || busy} onClick={watch}>
        {t('office.boost')}
      </button>
      <span className="mono sub">{note}</span>
      {!adsReady && <span className="sub warn">{t('office.adUnavailable')}</span>}
    </div>
  );
}

export function OfficeScreen({ onSettings, onGoTo, onOpenEvent }: { onSettings?: () => void; onGoTo?: (tab: GoalTab) => void; onOpenEvent?: () => void }) {
  const activeDept = useGame((s) => s.state.activeDept);
  const dept = findDepartment(content, activeDept);
  const [mode, setMode] = useState<BuyMode>(1);
  const accentStyle = { '--accent': dept.accent } as CSSProperties;
  return (
    <section className="screen office" data-dept={dept.id} style={accentStyle}>
      <CurrencyBar onSettings={onSettings} />
      {onOpenEvent && <EventBanner onOpen={onOpenEvent} />}
      <DeptChips />
      <h2 className="dept-title">{t('office.deptTitle', { name: dept.name })}</h2>
      <NextGoal onGoTo={onGoTo} />
      <QueueCard />
      <StampButton />
      <OvertimeBoost />
      <div className="section-head">
        <h3>{t('office.staff')}</h3>
        <div className="mode-switch" role="group" aria-label={t('office.buyAmountAria')} data-coach="buy-mode">
          {MODES.map((m) => (
            <button key={String(m)} className={'btn btn-ghost' + (mode === m ? ' active' : '')} onClick={() => setMode(m)} aria-label={`×${m}`}>×{m}</button>
          ))}
        </div>
      </div>
      {dept.staff.map((s, i) => <StaffRow key={s.id} staff={s} mode={mode} index={i} />)}
      <div className="section-head"><h3>{t('office.upgrades')}</h3></div>
      {dept.upgrades.map((u, i) => <UpgradeRow key={u.id} upgrade={u} first={i === 0} />)}
      <MemoTicker />
    </section>
  );
}
