import { simulate, vouchersPerDay, maxSealsPerAudit, type SimResult } from './simulate';
import { content } from '../data';

function table(label: string, r: SimResult) {
  console.log(`\n== ${label} ==`);
  console.log('day  soulsRun         kc               FY  audits  seals  vch  +vch  crd  eq  ach  cp  cl  depts');
  for (const d of r.days) {
    console.log(
      `${String(d.day).padStart(3)}  ${d.soulsRun.padEnd(16)} ${d.kc.padEnd(16)} ${String(d.fiscalYear).padStart(2)}  ${String(d.audits).padStart(6)}  ${String(d.seals).padStart(5)}  ${String(d.vouchers).padStart(3)}  ${String(d.vouchersEarned).padStart(4)}  ${String(d.cards).padStart(3)}  ${String(d.equipped).padStart(2)}  ${String(d.achievements).padStart(3)}  ${String(d.cosmicPoints).padStart(2)}  ${String(d.clauses).padStart(2)}  ${d.deptsUnlocked.join(',')}`,
    );
  }
  console.log('first unlock (played sec):', r.firstUnlockSec);
  console.log('first unlock (fiscal year):', r.firstUnlockYear);
  console.log('audit ready: day', r.firstAuditReadyDay, 'at played sec', r.firstAuditReadySec);
  console.log('time-to-audit per run (played sec):', r.auditReadySecByRun.join(', '));
  const ratios = r.auditReadySecByRun.slice(1, 5).map((sec, i) => (sec / r.auditReadySecByRun[i]).toFixed(3));
  console.log('run N+1 / run N (first five runs):', ratios.join(', '), '(target <= 0.850)');
  console.log('seals per audit:', r.sealsPerAudit.join(', '));
  console.log('max seals per audit:', maxSealsPerAudit(r), '(target <= 200)');
  console.log('cosmic filed on days:', r.cosmicDays.join(', ') || 'never', '(target: first between day 8 and 30)');
  console.log(
    'vouchers/day, days 3-14: faucet', vouchersPerDay(r, 3, 14, 'tasks').toFixed(2), '(target 2-4)',
    '| achievements', vouchersPerDay(r, 3, 14, 'achievements').toFixed(2),
    '| all sources', vouchersPerDay(r, 3, 14).toFixed(2),
  );
}

table('check-in player (5 x 3 min, 3 clicks/s)', simulate({ sessionsPerDay: 5, sessionSec: 180, clicksPerSec: 3, days: 30 }, content));
table('active player (2 x 30 min, 5 clicks/s)', simulate({ sessionsPerDay: 2, sessionSec: 1800, clicksPerSec: 5, days: 14 }, content));
