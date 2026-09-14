import { useState, type CSSProperties } from 'react';
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

const MODES: BuyMode[] = [1, 10, 'max'];

export function OfficeScreen() {
  const activeDept = useGame((s) => s.state.activeDept);
  const dept = findDepartment(content, activeDept);
  const [mode, setMode] = useState<BuyMode>(1);
  const accentStyle = { '--accent': dept.accent } as CSSProperties;
  return (
    <section className="screen office" style={accentStyle}>
      <CurrencyBar />
      <DeptChips />
      <h2 className="dept-title">{dept.name} Department</h2>
      <QueueCard />
      <StampButton />
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
