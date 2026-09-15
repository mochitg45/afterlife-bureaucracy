import { describe, it, expect } from 'vitest';
import { encodeSave, decodeSave, SAVE_CODE_PREFIX, MAX_SAVE_CODE_CHARS } from './saveCode';

describe('saveCode', () => {
  it('round-trips a json payload', () => {
    const json = JSON.stringify({ v: 6, souls: '1.234e12', name: 'Clerk' });
    expect(decodeSave(encodeSave(json))).toBe(json);
  });

  it('round-trips non-ascii text', () => {
    const json = JSON.stringify({ note: 'Валгалла — 死者の部屋 ✦' });
    expect(decodeSave(encodeSave(json))).toBe(json);
  });

  it('round-trips an empty object and a large payload', () => {
    expect(decodeSave(encodeSave('{}'))).toBe('{}');
    // Large, but still inside the decoder's length cap.
    const big = JSON.stringify({ blob: 'x'.repeat(40_000) });
    expect(encodeSave(big).length).toBeLessThan(MAX_SAVE_CODE_CHARS);
    expect(decodeSave(encodeSave(big))).toBe(big);
  });

  it('produces the documented shape: prefix, base64url body, 8 hex checksum', () => {
    const code = encodeSave('{"a":1}');
    expect(code.startsWith(SAVE_CODE_PREFIX)).toBe(true);
    const parts = code.split('.');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('AB1');
    expect(parts[1]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parts[1]).not.toContain('=');
    expect(parts[2]).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic', () => {
    expect(encodeSave('{"a":1}')).toBe(encodeSave('{"a":1}'));
  });

  it('rejects a wrong prefix', () => {
    const code = encodeSave('{"a":1}');
    const bad = 'AB2' + code.slice(3);
    expect(() => decodeSave(bad)).toThrow('Invalid save code');
  });

  it('rejects a missing prefix', () => {
    const body = encodeSave('{"a":1}').split('.').slice(1).join('.');
    expect(() => decodeSave(body)).toThrow('Invalid save code');
  });

  it('rejects a tampered checksum', () => {
    const parts = encodeSave('{"a":1}').split('.');
    const flipped = parts[2] === '00000000' ? '00000001' : '00000000';
    expect(() => decodeSave(`${parts[0]}.${parts[1]}.${flipped}`)).toThrow('Invalid save code');
  });

  it('rejects a tampered payload', () => {
    const original = encodeSave('{"a":1}');
    const tampered = encodeSave('{"a":2}');
    const parts = original.split('.');
    const swapped = `${parts[0]}.${tampered.split('.')[1]}.${parts[2]}`;
    expect(() => decodeSave(swapped)).toThrow('Invalid save code');
  });

  it('rejects garbage, empty input and the wrong number of segments', () => {
    for (const bad of ['', 'AB1', 'AB1.', 'AB1.abc', 'AB1.abc.def.ghi', 'not a code at all', '....']) {
      expect(() => decodeSave(bad)).toThrow('Invalid save code');
    }
  });

  it('tolerates surrounding whitespace when decoding', () => {
    const code = encodeSave('{"a":1}');
    expect(decodeSave(`  ${code}\n`)).toBe('{"a":1}');
  });

  it('rejects an oversized code before decoding it', () => {
    // A real save is a few kilobytes. Anything past the cap is refused on its length alone,
    // before any base64 or JSON work touches it.
    const body = 'A'.repeat(MAX_SAVE_CODE_CHARS);
    expect(() => decodeSave(`AB1.${body}.0000000a`)).toThrow('Invalid save code');
    const big = JSON.stringify({ pad: 'x'.repeat(MAX_SAVE_CODE_CHARS) });
    const code = encodeSave(big);
    expect(code.length).toBeGreaterThan(MAX_SAVE_CODE_CHARS);
    expect(() => decodeSave(code)).toThrow('Invalid save code');
  });
});
