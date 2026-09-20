import { simulate, vouchersPerDay, maxSealsPerAudit, type SimResult } from './simulate';
import { content } from '../data';
import { SEAL_CAP_PER_AUDIT } from '../engine/prestige';

function table(label: string, r: SimResult) {
  console.log(`\n== ${label} ==`);
  console.log('day  soulsRun         kc               FY  audits  seals  vch  +vch  tsk  pul  fre  ads  crd  eq  ach  cp  cl  depts');
  for (const d of r.days) {
    console.log(
      `${String(d.day).padStart(3)}  ${d.soulsRun.padEnd(16)} ${d.kc.padEnd(16)} ${String(d.fiscalYear).padStart(2)}  ${String(d.audits).padStart(6)}  ${String(d.seals).padStart(5)}  ${String(d.vouchers).padStart(3)}  ${String(d.vouchersEarned).padStart(4)}  ${String(d.vouchersFromTasks).padStart(3)}  ${String(d.pullsToday).padStart(3)}  ${String(d.freePullsToday).padStart(3)}  ${String(d.adsToday).padStart(3)}  ${String(d.cards).padStart(3)}  ${String(d.equipped).padStart(2)}  ${String(d.achievements).padStart(3)}  ${String(d.cosmicPoints).padStart(2)}  ${String(d.clauses).padStart(2)}  ${d.deptsUnlocked.join(',')}`,
    );
  }
  console.log('first unlock (played sec):', r.firstUnlockSec);
  console.log('first unlock (fiscal year):', r.firstUnlockYear);
  console.log('audit ready: day', r.firstAuditReadyDay, 'at played sec', r.firstAuditReadySec);
  console.log('time-to-audit per run (played sec):', r.auditReadySecByRun.join(', '));
  const ratios = r.auditReadySecByRun.slice(1, 5).map((sec, i) => (sec / r.auditReadySecByRun[i]).toFixed(3));
  console.log('run N+1 / run N (first five runs):', ratios.join(', '), '(target <= 0.850)');
  console.log('seals per audit:', r.sealsPerAudit.join(', '));
  const caps = r.sealMultPerAudit.map((m) => SEAL_CAP_PER_AUDIT * m);
  const over = r.sealsPerAudit.filter((n, i) => n > caps[i]).length;
  console.log('cap in force per audit:', caps.join(', '));
  console.log('max seals per audit:', maxSealsPerAudit(r), '| audits over their own cap:', over, '(target 0)');
  console.log(
    'cosmic filed on days:', r.cosmicDays.join(', ') || 'never',
    `(${r.cosmicDays.length} filings; target 2-5 in 30 days, first between day 8 and 30)`,
  );
  console.log(
    'vouchers/day, days 3-14: faucet', vouchersPerDay(r, 3, 14, 'tasks').toFixed(2), '(target 20-40)',
    '| achievements', vouchersPerDay(r, 3, 14, 'achievements').toFixed(2),
    '| all sources', vouchersPerDay(r, 3, 14).toFixed(2),
  );
  const slice = r.days.filter((d) => d.day >= 3 && d.day <= 14);
  const mean = (pick: (d: typeof slice[number]) => number) => slice.reduce((t, d) => t + pick(d), 0) / (slice.length || 1);
  console.log(
    'pulls/day, days 3-14: effective', mean((d) => d.pullsToday).toFixed(2),
    '| of which free', mean((d) => d.freePullsToday).toFixed(2),
    '| ads/day', mean((d) => d.adsToday).toFixed(2),
  );
}

table('check-in player (5 x 3 min, 3 clicks/s)', simulate({ sessionsPerDay: 5, sessionSec: 180, clicksPerSec: 3, days: 30 }, content));
table('active player (2 x 30 min, 5 clicks/s)', simulate({ sessionsPerDay: 2, sessionSec: 1800, clicksPerSec: 5, days: 14 }, content));
