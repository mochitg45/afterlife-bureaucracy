# Economy notes: Seals, perk levels and the Audit requirement

Simulate a year for the check-in player (five 3-minute sessions a day) with
`npx tsx src/sim/year.ts 365`. It prints a progress table, the day each piece of content
completes, the Seal balance and the time-to-audit (real elapsed hours, offline gaps included).

## Perk levels (the Seal sink)

An owned perk is level 1 and can be raised to `MAX_PERK_LEVEL` (10) with Seals.

- Upgrade cost from level L to L+1: `ceil(perk.cost * 2^(L-1))` (`UPGRADE_GROWTH` = 2).
- Effect at level L: `base value * (1 + 0.25 * (L-1))` (`LEVEL_STEP` = 0.25), so level 10 is x3.25.
  Multipliers (`globalMult`, `deptMult`) still combine as `1 + value` per perk, multiplied together;
  additive types (`click`, `offlineCapHours`, `offlineRate`, `voucherMult`) still sum.
- Not upgradable: `equipSlots`, `headStartDept`, `headStartStaff` (discrete grants).
- State: `perkLevels` (sparse; an owned perk with no entry is level 1) and `sealsInvested`.
  Save version 11 (v10 saves load with every perk at level 1).
- A Cosmic Restructuring clears `perks`, `perkLevels` and `sealsInvested` together.
- Seals spent on levels keep counting for two things, tracked in `sealsInvested`: the +2% per Seal
  global bonus (`economy.globalMult`) and the Cosmic threshold (`canCosmic`). Without that, a
  level sink drained the wallet that both of those read and the year stalled (no Restructuring
  ever). So upgrading never lowers output and never delays a Restructuring; it is pure upside.
  Buying a new perk still spends Seals as before.

## Audit requirement

`auditThreshold(fiscalYear, cosmics)`:

1. `AUDIT_BASE * 1.5^(FY-1)` up to `TAPER_FY` (12). Unchanged, so onboarding is identical.
2. Past FY 12, `* (FY/12)^TAPER_POWER`, with `TAPER_POWER` lowered from 5 to 3.6.
3. `* 10^(COSMIC_AUDIT_LOG10[cosmics] * min(1, (FY-1)/COSMIC_AUDIT_RAMP_FY))`, with
   `COSMIC_AUDIT_LOG10 = [0, 0.9, 2.6, 2.4, 2.5, 3.1, 2.9, 2.5]` and a 16-year ramp.
   A player who has never restructured gets factor 1.

Why: each Restructuring leaves permanent income (Clauses, cards, a faster rebuild) that the fiscal-year
curve does not know about, so late runs met the souls requirement in 3-6 seconds and the 8-hour
`MIN_FISCAL_YEAR_MS` was the only gate. The table was fitted with the simulator so the check-in
player meets the threshold about 5 hours into the 8-hour window (median 5.1 h, p90 5.7 h). Boosts,
better cards and active play get there earlier; there is no wall (a player who is not ready at the
first check-in is ready at the next).

If income changes (new departments, new Clause values, a different Seal cap), re-fit
`COSMIC_AUDIT_LOG10` and `TAPER_POWER`: run the simulator and read `time-to-audit`.
