import Decimal from 'break_infinity.js';
import { formatNumber } from './format';

describe('formatNumber', () => {
  it('shows plain integers below one million', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(999999)).toBe('999,999');
    expect(formatNumber(12.7)).toBe('12');
  });
  it('uses suffixes with 3 significant digits from one million', () => {
    expect(formatNumber(1_000_000)).toBe('1.00M');
    expect(formatNumber(1_234_567)).toBe('1.23M');
    expect(formatNumber(12_345_678)).toBe('12.3M');
    expect(formatNumber(123_456_789)).toBe('123M');
    expect(formatNumber(new Decimal('2.5e9'))).toBe('2.50B');
    expect(formatNumber(new Decimal('1e12'))).toBe('1.00T');
    expect(formatNumber(new Decimal('1e33'))).toBe('1.00Dc');
  });
  it('switches to letter suffixes after Dc', () => {
    expect(formatNumber(new Decimal('1e36'))).toBe('1.00aa');
    expect(formatNumber(new Decimal('1e39'))).toBe('1.00ab');
    expect(formatNumber(new Decimal('1e111'))).toBe('1.00az');
  });
  it('accepts Decimal below one million', () => {
    expect(formatNumber(new Decimal(4200))).toBe('4,200');
  });
  it('rolls the mantissa over into the next magnitude at the top of a bracket', () => {
    expect(formatNumber(999_999_999)).toBe('1.00B');
    expect(formatNumber(new Decimal('9.999e11'))).toBe('1.00T');
    expect(formatNumber(new Decimal('999.9e33'))).toBe('1.00aa');
    expect(formatNumber(999_499_999)).toBe('999M');
  });
});
