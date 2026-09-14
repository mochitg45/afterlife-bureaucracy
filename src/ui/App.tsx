import { useEffect, useState } from 'react';
import { useGame } from '../store/game';
import { TabBar, type TabId } from './components/TabBar';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { OfficeScreen } from './screens/OfficeScreen';

export function App() {
  const [tab, setTab] = useState<TabId>('office');
  const boot = useGame((s) => s.boot);
  const ready = useGame((s) => s.ready);
  useEffect(() => { void boot(); }, [boot]);

  return (
    <div className="app">
      {!ready && <section className="screen"><h2>Opening the office…</h2></section>}
      {ready && tab === 'office' && <OfficeScreen />}
      {ready && tab === 'personnel' && <PlaceholderScreen title="Personnel" note="Requisition Lottery opens in a later update." />}
      {ready && tab === 'ledger' && <PlaceholderScreen title="Ledger" note="Fiscal Year Audits open in a later update." />}
      {ready && tab === 'tasks' && <PlaceholderScreen title="Tasks" note="Daily tasks and achievements open in a later update." />}
      {ready && tab === 'store' && <PlaceholderScreen title="Store" note="Requisition Vouchers store opens in a later update." />}
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
