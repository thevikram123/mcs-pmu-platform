/**
 * Fidelity gate.
 *
 * These figures were established by auditing the source workbooks formula by
 * formula. If the engine stops reproducing them the platform is lying about
 * GVPR's numbers, so CI blocks the deploy on this file.
 */

import { describe, expect, it } from 'vitest';
import baselineJson from '../data/baseline.json';
import type { Baseline } from './types';
import { computeScenario, DEFAULT_GLOBALS, emptyOverrides, reanchor, YEARS } from './engine';

const baseline = baselineJson as unknown as Baseline;
const RUPEE = 1; // tolerance: one rupee across a Rs.1,074 Cr model

// Audited against MCS_Job_Cost_Report_6Year.xlsx and Overhead Cost.xlsx.
const WORKBOOK = {
  capex: 3_294_610_663.98,
  opex: 6_917_661_679.69,
  overhead: 532_324_821.19,
  overheadLock: 500_000_000,
  total: 10_744_597_164.86,
  gst18: 1_934_027_489.68,
  // 'OPEX BOQ - Detail'!J292..O292
  opexYears: [
    908_420_479, 1_186_235_067.11, 1_191_913_249.12, 1_202_162_835.56, 1_209_923_026.94,
    1_219_007_021.96,
  ],
  // Schedule subtotals, 'CAPEX BOQ - Detail'!K83,K142,K167,K193,K213,K223,K231
  capexSchedules: {
    A: 1_821_678_103,
    B: 821_581_794.990668,
    C: 331_729_376.2684,
    D: 112_932_185.344,
    E: 40_930_660,
    F: 153_243_333.333333,
    G: 12_515_211.0438492,
  } as Record<string, number>,
};

describe('baseline data integrity', () => {
  it('carries every line item from the three workbooks', () => {
    expect(baseline.capexItems).toHaveLength(161);
    expect(baseline.opexItems).toHaveLength(217);
    expect(baseline.overheadItems).toHaveLength(16);
    expect(baseline.schedules).toHaveLength(20); // 7 CAPEX + 12 OPEX + 1 overhead
  });

  it('each schedule total equals the sum of its own line items — no gap, no double count', () => {
    for (const s of baseline.schedules) {
      if (s.kind === 'capex') {
        const sum = baseline.capexItems
          .filter((i) => i.schedule === s.id)
          .reduce((a, i) => a + i.amountExGst, 0);
        expect(sum, `CAPEX schedule ${s.id}`).toBeCloseTo(s.sourceTotal, 2);
      } else if (s.kind === 'opex') {
        const sum = baseline.opexItems
          .filter((i) => i.schedule === s.id)
          .reduce((a, i) => a + i.years.reduce((x, y) => x + y, 0), 0);
        expect(sum, `OPEX schedule ${s.id}`).toBeCloseTo(s.sourceTotal, 2);
      }
    }
  });

  it('every item belongs to a declared schedule', () => {
    const ids = new Set(baseline.schedules.map((s) => s.id));
    for (const i of [...baseline.capexItems, ...baseline.opexItems]) {
      expect(ids.has(i.schedule), `orphan item ${i.id}`).toBe(true);
    }
  });

  it('records the two source defects found during the audit', () => {
    const ids = baseline.dataQuality.map((d) => d.id);
    expect(ids).toContain('opex-summary-gst-shift');
    expect(ids).toContain('opex-o1-row279-year3');
  });
});

describe('at default settings the engine reproduces the workbooks', () => {
  const r = computeScenario(baseline, emptyOverrides());

  it('CAPEX total', () => expect(r.totals.capex).toBeCloseTo(WORKBOOK.capex, 1));
  it('OPEX total', () => expect(r.totals.opex).toBeCloseTo(WORKBOOK.opex, 1));
  it('Overhead total (bottom-up)', () =>
    expect(r.totals.overhead).toBeCloseTo(WORKBOOK.overhead, 1));
  it('project total ex-GST', () => expect(r.totals.exGst).toBeCloseTo(WORKBOOK.total, 1));
  it('GST at 18%', () => expect(r.totals.gst).toBeCloseTo(WORKBOOK.gst18, 1));
  it('incl-GST total', () =>
    expect(r.totals.inclGst).toBeCloseTo(WORKBOOK.total + WORKBOOK.gst18, 1));

  it('OPEX year-wise split matches row 292 of the detail sheet', () => {
    for (let y = 0; y < YEARS; y++) {
      expect(r.byYear[y].opex, `year ${y + 1}`).toBeCloseTo(WORKBOOK.opexYears[y], 1);
    }
  });

  it('each CAPEX schedule matches its subtotal cell', () => {
    for (const [id, want] of Object.entries(WORKBOOK.capexSchedules)) {
      const got = r.bySchedule.find((s) => s.id === id)!;
      expect(got.exGst, `schedule ${id}`).toBeCloseTo(want, 1);
    }
  });

  it('puts all CAPEX in Year 1, per the source cash-flow convention', () => {
    expect(r.byYear[0].capex).toBeCloseTo(WORKBOOK.capex, 1);
    for (let y = 1; y < YEARS; y++) expect(r.byYear[y].capex).toBe(0);
  });

  it('Track 2 OPEX is absent from Year 1', () => {
    const t2 = r.bySchedule.filter((s) => s.kind === 'opex' && s.track === 'Track 2');
    expect(t2.length).toBe(4); // H2, I2, J2, O2
    for (const s of t2) expect(s.years[0]).toBe(0);
  });

  it('year rows sum to the project total', () => {
    const sum = r.byYear.reduce((a, y) => a + y.exGst, 0);
    expect(sum).toBeCloseTo(r.totals.exGst, 1);
  });

  it('schedule rollup sums to the project total', () => {
    const sum = r.bySchedule.reduce((a, s) => a + s.exGst, 0);
    expect(sum).toBeCloseTo(r.totals.exGst, 1);
  });

  it('every pivot sums to the same project total', () => {
    for (const [label, gp] of [
      ['track', r.byTrack],
      ['oem', r.byOem],
      ['category', r.byCategory],
      ['phase', r.byPhase],
    ] as const) {
      const sum = gp.reduce((a, x) => a + x.exGst, 0);
      expect(sum, `pivot ${label}`).toBeCloseTo(r.totals.exGst, 1);
    }
  });
});

describe('overhead modes', () => {
  it('lock50cr lands on exactly Rs.50 Cr', () => {
    const r = computeScenario(baseline, {
      ...emptyOverrides(),
      globals: { overheadMode: 'lock50cr' },
    });
    expect(r.totals.overhead).toBeCloseTo(WORKBOOK.overheadLock, 2);
  });

  it('lock50cr preserves each line’s relative weight', () => {
    const bottom = computeScenario(baseline, emptyOverrides());
    const locked = computeScenario(baseline, {
      ...emptyOverrides(),
      globals: { overheadMode: 'lock50cr' },
    });
    const share = (res: typeof bottom, id: string) =>
      res.byItem.find((i) => i.id === id)!.exGst / res.totals.overhead;
    for (const it of baseline.overheadItems) {
      expect(share(locked, it.id)).toBeCloseTo(share(bottom, it.id), 9);
    }
  });

  it('bottom-up overhead reproduces the per-year source figures', () => {
    const r = computeScenario(baseline, emptyOverrides());
    const wantY1 = baseline.overheadItems.reduce((a, i) => a + i.sourceYears[0], 0);
    expect(r.byYear[0].overhead).toBeCloseTo(wantY1, 1);
  });
});

describe('global levers', () => {
  it('GST rate scales GST and leaves the ex-GST base alone', () => {
    const r = computeScenario(baseline, { ...emptyOverrides(), globals: { gstRate: 0.12 } });
    expect(r.totals.exGst).toBeCloseTo(WORKBOOK.total, 1);
    expect(r.totals.gst).toBeCloseTo(WORKBOOK.total * 0.12, 1);
  });

  it('inflation delta compounds from Year 2 and leaves Year 1 untouched', () => {
    const base = computeScenario(baseline, emptyOverrides());
    const hot = computeScenario(baseline, {
      ...emptyOverrides(),
      globals: { inflationDelta: 0.05 },
    });
    expect(hot.byYear[0].opex).toBeCloseTo(base.byYear[0].opex, 1);
    expect(hot.byYear[1].opex).toBeCloseTo(base.byYear[1].opex * 1.05, 1);
    expect(hot.byYear[5].opex).toBeCloseTo(base.byYear[5].opex * 1.05 ** 5, 1);
    expect(hot.totals.opex).toBeGreaterThan(base.totals.opex);
  });

  it('inflation delta of zero is an exact no-op', () => {
    const r = computeScenario(baseline, { ...emptyOverrides(), globals: { inflationDelta: 0 } });
    expect(r.totals.exGst).toBeCloseTo(WORKBOOK.total, RUPEE);
  });

  it('contingency lifts CAPEX and OPEX independently', () => {
    const r = computeScenario(baseline, {
      ...emptyOverrides(),
      globals: { capexContingency: 0.02, opexContingency: 0 },
    });
    expect(r.totals.capex).toBeCloseTo(WORKBOOK.capex * 1.02, 1);
    expect(r.totals.opex).toBeCloseTo(WORKBOOK.opex, 1);
  });

  it('CAPEX phasing redistributes without changing the total', () => {
    const r = computeScenario(baseline, {
      ...emptyOverrides(),
      globals: { capexPhasing: [0.5, 0.5, 0, 0, 0, 0] },
    });
    expect(r.totals.capex).toBeCloseTo(WORKBOOK.capex, 1);
    expect(r.byYear[0].capex).toBeCloseTo(WORKBOOK.capex / 2, 1);
    expect(r.byYear[1].capex).toBeCloseTo(WORKBOOK.capex / 2, 1);
  });
});

describe('Track 2 re-anchoring', () => {
  it('leaves the vector identical at the source default of Year 2', () => {
    expect(reanchor([0, 10, 20, 30, 40, 50], 2)).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it('slipping to Year 3 shifts right and drops spend past the horizon', () => {
    expect(reanchor([0, 10, 20, 30, 40, 50], 3)).toEqual([0, 0, 10, 20, 30, 40]);
  });

  it('pulling forward to Year 1 shifts left and holds the final value', () => {
    expect(reanchor([0, 10, 20, 30, 40, 50], 1)).toEqual([10, 20, 30, 40, 50, 50]);
  });

  it('ignores vectors that have no leading zero', () => {
    expect(reanchor([5, 5, 5, 5, 5, 5], 4)).toEqual([5, 5, 5, 5, 5, 5]);
  });

  it('slipping Track 2 reduces the 6-year OPEX total', () => {
    const base = computeScenario(baseline, emptyOverrides());
    const slip = computeScenario(baseline, {
      ...emptyOverrides(),
      globals: { track2StartYear: 3 },
    });
    expect(slip.totals.opex).toBeLessThan(base.totals.opex);
    for (const s of slip.bySchedule.filter((x) => x.kind === 'opex' && x.track === 'Track 2')) {
      expect(s.years[1], `${s.id} year 2`).toBe(0);
    }
  });
});

describe('schedule and item overrides', () => {
  it('a schedule multiplier scales only that schedule', () => {
    const r = computeScenario(baseline, { ...emptyOverrides(), scheduleMul: { A: 1.1 } });
    expect(r.bySchedule.find((s) => s.id === 'A')!.exGst).toBeCloseTo(
      WORKBOOK.capexSchedules.A * 1.1,
      1,
    );
    expect(r.bySchedule.find((s) => s.id === 'B')!.exGst).toBeCloseTo(
      WORKBOOK.capexSchedules.B,
      1,
    );
  });

  it('a CAPEX qty override moves the total by exactly one unit rate', () => {
    const item = baseline.capexItems[0];
    const r = computeScenario(baseline, {
      ...emptyOverrides(),
      itemOverride: { [item.id]: { qty: item.qty + 1 } },
    });
    expect(r.totals.capex).toBeCloseTo(WORKBOOK.capex + item.unitRate, 1);
  });

  it('excluding an item removes its full value', () => {
    const item = baseline.opexItems.find((i) => i.schedule === 'H1')!;
    const r = computeScenario(baseline, {
      ...emptyOverrides(),
      itemOverride: { [item.id]: { excluded: true } },
    });
    const removed = item.years.reduce((a, b) => a + b, 0);
    expect(r.totals.opex).toBeCloseTo(WORKBOOK.opex - removed, 1);
  });

  it('a per-schedule GST rate overrides the global one', () => {
    const r = computeScenario(baseline, {
      ...emptyOverrides(),
      gstBySchedule: { A: 0.05 },
    });
    const a = r.bySchedule.find((s) => s.id === 'A')!;
    expect(a.gst).toBeCloseTo(a.exGst * 0.05, 1);
    const b = r.bySchedule.find((s) => s.id === 'B')!;
    expect(b.gst).toBeCloseTo(b.exGst * 0.18, 1);
  });

  it('default globals are the source values', () => {
    expect(DEFAULT_GLOBALS.gstRate).toBe(0.18);
    expect(DEFAULT_GLOBALS.inflationDelta).toBe(0);
    expect(DEFAULT_GLOBALS.track2StartYear).toBe(2);
    expect(DEFAULT_GLOBALS.overheadMode).toBe('bottomUp');
  });
});
