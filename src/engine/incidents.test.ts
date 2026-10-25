import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import { computeRates, globalMult } from './economy';
import { applyOffline } from './offline';
import {
  nextSpawnDelay, canSpawn, makeIncident, incidentReward, incidentPenalty, incidentFactor,
  SPAWN_MIN_MS, SPAWN_MAX_MS, PENALTY_CAP, type Incident,
} from './incidents';

const inc = (spawnedMono: number): Incident => ({ id: 1, kind: 'printer', x: 0, y: 0, spawnedMono, taps: 0, need: 3 });

describe('incidents', () => {
  it('spawns every 2-4 minutes', () => {
    expect(nextSpawnDelay(() => 0)).toBe(SPAWN_MIN_MS);
    expect(nextSpawnDelay(() => 1)).toBe(SPAWN_MAX_MS);
  });
  it('never spawns in the tutorial or past two active', () => {
    expect(canSpawn(0, 2)).toBe(false);
    expect(canSpawn(0, 3)).toBe(true);
    expect(canSpawn(1, 3)).toBe(true);
    expect(canSpawn(2, 3)).toBe(false);
  });
  it('picks 3-5 taps and avoids taken kinds and spots', () => {
    const a = makeIncident(1, 0, [], () => 0);
    const b = makeIncident(2, 0, [a], () => 0);
    expect(a.need).toBe(3);
    expect(makeIncident(3, 0, [], () => 0.999).need).toBe(5);
    expect(b.kind).not.toBe(a.kind);
    expect([b.x, b.y]).not.toEqual([a.x, a.y]);
  });
  it('rewards 3 minutes of income, capped, and nothing at zero income', () => {
    const r = incidentReward(new Decimal(10), new Decimal(4), new Decimal(1e6));
    expect(r.souls.toNumber()).toBe(1800);
    expect(r.kc.toNumber()).toBe(720);
    expect(incidentReward(new Decimal(1000), new Decimal(400), new Decimal(100)).souls.toNumber()).toBe(10);
    expect(incidentReward(new Decimal(0), new Decimal(0), new Decimal(5)).souls.toNumber()).toBe(0);
  });
  it('penalty starts after 60 s, ramps 5% to 10%, total capped at 15%', () => {
    expect(incidentPenalty(59_000)).toBe(0);
    expect(incidentPenalty(60_000)).toBeCloseTo(0.05);
    expect(incidentPenalty(1e9)).toBeCloseTo(0.1);
    expect(incidentFactor([inc(0)], 30_000)).toBe(1);
    expect(incidentFactor([inc(0), inc(0)], 1e9)).toBeCloseTo(1 - PENALTY_CAP);
  });
  it('hits the office tick rates only, never offline pay', () => {
    const s = { ...createInitialState({ wall: 0, mono: 0 }, content), staff: { dave: 1 } };
    const full = computeRates(s, content, 0).soulsPerSec;
    const hit = computeRates(s, content, 0, 0.9).soulsPerSec;
    expect(hit.div(full).toNumber()).toBeCloseTo(0.9);
    expect(globalMult(s, content, 0, 0.85).div(globalMult(s, content, 0)).toNumber()).toBeCloseTo(0.85);
    const off = applyOffline(s, content, 600, 0);
    expect(off.souls.toNumber()).toBeCloseTo(full.mul(600).mul(0.5).toNumber());
  });
});
