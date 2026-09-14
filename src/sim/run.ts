import { simulate, type SimResult } from './simulate';
import { content } from '../data';

function table(label: string, r: SimResult) {
  console.log(`\n== ${label} ==`);
  console.log('day  soulsRun         kc               FY  audits  seals  depts');
  for (const d of r.days) {
    console.log(
      `${String(d.day).padStart(3)}  ${d.soulsRun.padEnd(16)} ${d.kc.padEnd(16)} ${String(d.fiscalYear).padStart(2)}  ${String(d.audits).padStart(6)}  ${String(d.seals).padStart(5)}  ${d.deptsUnlocked.join(',')}`,
    );
  }
  console.log('first unlock (played sec):', r.firstUnlockSec);
  console.log('first unlock (fiscal year):', r.firstUnlockYear);
  console.log('audit ready: day', r.firstAuditReadyDay, 'at played sec', r.firstAuditReadySec);
}

table('check-in player (5 x 3 min, 3 clicks/s)', simulate({ sessionsPerDay: 5, sessionSec: 180, clicksPerSec: 3, days: 14 }, content));
table('active player (2 x 30 min, 5 clicks/s)', simulate({ sessionsPerDay: 2, sessionSec: 1800, clicksPerSec: 5, days: 14 }, content));
