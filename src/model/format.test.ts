/**
 * Display-precision guarantees.
 *
 * An editable field must never show a number that differs from the one the
 * model holds — a unit rate of 58,739.6252 rendered as "58,740" invites the
 * user to commit the rounded figure without realising anything changed.
 */

import { describe, expect, it } from 'vitest';
import baselineJson from '../data/baseline.json';
import type { Baseline } from './types';
import { crore, differs, preciseNum, rupees } from './format';

const baseline = baselineJson as unknown as Baseline;

describe('preciseNum', () => {
  it('keeps the decimals a source figure actually carries', () => {
    expect(preciseNum(58739.6252)).toBe('58,739.6252');
    expect(preciseNum(82484334.333333)).toBe('8,24,84,334.3333');
    expect(preciseNum(821581794.990668)).toBe('82,15,81,794.9907');
  });

  it('does not decorate whole numbers with trailing zeros', () => {
    expect(preciseNum(55200)).toBe('55,200');
    expect(preciseNum(0)).toBe('0');
    expect(preciseNum(1800000)).toBe('18,00,000');
  });

  it('groups in the Indian convention', () => {
    expect(preciseNum(10000000)).toBe('1,00,00,000');
  });

  it('round-trips through the parser the input uses on commit', () => {
    const parse = (s: string) => Number(s.replace(/[,\s₹−]/g, ''));
    for (const n of [58739.6252, 55200, 82484334.3333, 0, 1800000]) {
      expect(parse(preciseNum(n))).toBeCloseTo(n, 4);
    }
  });

  it('never renders a value that misstates a real CAPEX unit rate', () => {
    const parse = (s: string) => Number(s.replace(/[,\s]/g, ''));
    const fractional = baseline.capexItems.filter((i) => !Number.isInteger(i.unitRate));
    expect(fractional.length).toBeGreaterThan(0); // the problem is real, not hypothetical
    for (const it of fractional) {
      // Displayed value must match the stored one to within a paisa.
      expect(Math.abs(parse(preciseNum(it.unitRate)) - it.unitRate)).toBeLessThan(0.01);
    }
  });

  it('never misstates a real OPEX annual figure', () => {
    const parse = (s: string) => Number(s.replace(/[,\s]/g, ''));
    let checked = 0;
    for (const it of baseline.opexItems) {
      for (const v of it.years) {
        if (Number.isInteger(v)) continue;
        expect(Math.abs(parse(preciseNum(v)) - v)).toBeLessThan(0.01);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('differs', () => {
  it('detects a sub-rupee edit on a large figure', () => {
    // The old absolute 0.5 epsilon called this unchanged.
    expect(differs(58740, 58739.6252)).toBe(true);
  });

  it('ignores floating-point noise', () => {
    expect(differs(0.1 + 0.2, 0.3)).toBe(false);
    expect(differs(3294610663.9802513, 3294610663.9802513)).toBe(false);
  });

  it('treats a genuine change as changed at any magnitude', () => {
    expect(differs(1, 2)).toBe(true);
    expect(differs(10000000.5, 10000000)).toBe(true);
  });
});

describe('negative currency formatting', () => {
  it('places the minus before the rupee symbol, not after', () => {
    expect(crore(-32_03_00_000)).toBe('−₹32.03 Cr');
    expect(rupees(-1500)).toBe('−₹1,500');
  });

  it('leaves positives unsigned', () => {
    expect(crore(3_29_46_10_664)).toBe('₹329.46 Cr');
  });
});
