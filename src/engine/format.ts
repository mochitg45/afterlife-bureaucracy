import Decimal from 'break_infinity.js';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

function letterSuffix(index: number): string {
  // index 12 -> 'aa', 13 -> 'ab', ..., 37 -> 'az', 38 -> 'ba'
  const n = index - 12;
  const first = String.fromCharCode(97 + Math.floor(n / 26));
  const second = String.fromCharCode(97 + (n % 26));
  return first + second;
}

export function formatNumber(value: Decimal | number): string {
  const d = value instanceof Decimal ? value : new Decimal(value);
  if (d.lt(1_000_000)) {
    return Math.floor(d.toNumber()).toLocaleString('en-US');
  }
  const exponent = Math.floor(d.log10());
  let index = Math.floor(exponent / 3);
  let mantissa = d.div(Decimal.pow(10, index * 3)).toNumber();
  let digits = mantissa >= 100 ? 0 : mantissa >= 10 ? 1 : 2;
  // Rounding the mantissa to `digits` places can push it up to 1000 (e.g. 999.9999 -> "1000"),
  // which would print as "1000M" instead of rolling over to the next magnitude ("1.00B").
  if (Number(mantissa.toFixed(digits)) >= 1000) {
    index += 1;
    mantissa = mantissa / 1000;
    digits = mantissa >= 100 ? 0 : mantissa >= 10 ? 1 : 2;
  }
  const suffix = index < SUFFIXES.length ? SUFFIXES[index] : letterSuffix(index);
  return mantissa.toFixed(digits) + suffix;
}
