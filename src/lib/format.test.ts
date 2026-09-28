import { describe, expect, it } from 'vitest';
import { dateInMonth, monthDiff, monthRange, parseMoney, shiftMonth } from './format';

describe('formatadores financeiros e de calendário', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['1234.56', 1234.56],
    ['R$ 20,00', 20],
    ['', Number.NaN],
  ])('converte %s em valor monetário', (input, expected) => {
    const value = parseMoney(input);
    if (Number.isNaN(expected)) expect(value).toBeNaN();
    else expect(value).toBe(expected);
  });

  it('respeita viradas de ano e diferenças entre meses', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(monthDiff('2025-12', '2026-02')).toBe(2);
  });

  it('limita vencimentos ao último dia do mês', () => {
    expect(dateInMonth('2028-02', 31)).toBe('2028-02-29');
    expect(monthRange('2027-02')).toEqual({ start: '2027-02-01', end: '2027-02-28' });
  });
});
