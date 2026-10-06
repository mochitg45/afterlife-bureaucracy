import { simulate } from './simulate';
import { content } from '../data';

/**
 * One simulated year for the check-in player (5 x 3 min a day): a monthly progress line and the
 * day each piece of content first completes, so "how long to beat it" has a number.
 * Run with `npx tsx src/sim/year.ts [days]`.
 */
const days = Number(process.argv[2] ?? 365);
const r = simulate({ sessionsPerDay: 5, sessionSec: 180, clicksPerSec: 3, days }, content);
const perks = content.perks.length;
const clauses = content.clauses.length;
const cards = content.cards.length;
const achs = content.achievements.length;
const depts = content.departments.length;

console.log(`== check-in player, ${days} days ==`);
console.log('day   FY  audits  seals  perks  lvlSum upgLeft  cosmic clauses depts  cards5*  ach   lifetime souls');
for (const d of r.days) {
  if (d.day % 30 !== 0 && d.day !== 7 && d.day !== 14 && d.day !== days) continue;
  console.log(
    `${String(d.day).padStart(3)}  ${String(d.fiscalYear).padStart(3)}  ${String(d.audits).padStart(6)}  ${String(d.seals).padStart(5)}  ${String(d.perks).padStart(2)}/${perks}  ${String(d.perkLevelSum).padStart(5)}  ${String(d.upgradesLeft).padStart(5)}  ${String(d.cosmics).padStart(6)}  ${String(d.clauses).padStart(3)}/${clauses}  ${String(d.deptsUnlocked.length).padStart(2)}/${depts}  ${String(d.cardsMaxed).padStart(4)}/${cards}  ${String(d.achievements).padStart(2)}/${achs}  ${d.soulsLifetime}`,
  );
}
const first = (pred: (d: (typeof r.days)[number]) => boolean) => r.days.find(pred)?.day ?? 'never';
console.log('\nfirst day with...');
console.log('  every department open:   ', first((d) => d.deptsUnlocked.length >= depts));
console.log('  every perk owned:        ', first((d) => d.perks >= perks));
console.log('  every clause bought:     ', first((d) => d.clauses >= clauses));
console.log('  every card at 5 stars:   ', first((d) => d.cardsMaxed >= cards));
console.log('  every achievement:       ', first((d) => d.achievements >= achs));
const hrs = (xs: number[]) => xs.map((x) => (x / 3600).toFixed(1)).join(', ');
const wall = r.auditReadyWallSecByRun;
console.log('time-to-audit, first 12 runs (elapsed h):', hrs(wall.slice(0, 12)));
console.log('time-to-audit, last 10 runs (elapsed h):', hrs(wall.slice(-10)));
console.log('time-to-audit, last 10 runs (played sec):', r.auditReadySecByRun.slice(-10).join(', '));
const q = (xs: number[], f: number) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * f)] ?? 0;
const lateRuns = wall.slice(Math.floor(wall.length / 2));
console.log(`time-to-audit, second half of year (elapsed h): p10 ${(q(lateRuns, 0.1) / 3600).toFixed(1)}  median ${(q(lateRuns, 0.5) / 3600).toFixed(1)}  p90 ${(q(lateRuns, 0.9) / 3600).toFixed(1)}  max ${(Math.max(...lateRuns) / 3600).toFixed(1)}`);
const sealsLate = r.days.filter((d) => d.day > 60).map((d) => d.seals);
console.log(`seals balance after day 60: median ${q(sealsLate, 0.5)}  p90 ${q(sealsLate, 0.9)}  max ${Math.max(...sealsLate)}`);
console.log('first audit ready (day, played sec):', r.firstAuditReadyDay, r.firstAuditReadySec);
console.log('cosmic filed on days:', r.cosmicDays.join(', ') || 'never');
