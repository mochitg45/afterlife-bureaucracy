import { useEffect, useState, type CSSProperties } from 'react';
import { useGame } from '../../store/game';
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

const MODES: BuyMode[] = [1, 10, 'max'];

/**
 * Rounded up to the minute so a countdown never reads "0h 0m" while there is still time on
 * it, and so the text only changes once a minute however often the tick fires.
 */
function fmtLeft(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

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
    ? `×2 for ${fmtLeft(boostLeft)}`
    : cooldownLeft > 0
      ? `Available in ${fmtLeft(cooldownLeft)}`
      : 'Watch an ad for four hours of double output.';

  return (
    <div className="card boost-card">
      <button className="btn btn-primary" aria-label="Overtime Boost" disabled={!ready || busy} onClick={watch}>
        Overtime Boost ×2
      </button>
      <span className="mono sub">{note}</span>
      {!adsReady && <span className="sub warn">Ad not available</span>}
    </div>
  );
}

export function OfficeScreen({ onSettings }: { onSettings?: () => void }) {
  const activeDept = useGame((s) => s.state.activeDept);
  const dept = findDepartment(content, activeDept);
  const [mode, setMode] = useState<BuyMode>(1);
  const accentStyle = { '--accent': dept.accent } as CSSProperties;
  return (
    <section className="screen office" style={accentStyle}>
      <CurrencyBar onSettings={onSettings} />
      <DeptChips />
      <h2 className="dept-title">{dept.name} Department</h2>
      <QueueCard />
      <StampButton />
      <OvertimeBoost />
      <div className="section-head">
        <h3>Staff</h3>
        <div className="mode-switch" role="group" aria-label="Buy amount">
          {MODES.map((m) => (
            <button key={String(m)} className={'btn btn-ghost' + (mode === m ? ' active' : '')} onClick={() => setMode(m)} aria-label={`×${m}`}>×{m}</button>
          ))}
        </div>
      </div>
      {dept.staff.map((s) => <StaffRow key={s.id} staff={s} mode={mode} />)}
      <div className="section-head"><h3>Upgrades</h3></div>
      {dept.upgrades.map((u) => <UpgradeRow key={u.id} upgrade={u} />)}
      <MemoTicker />
    </section>
  );
}
