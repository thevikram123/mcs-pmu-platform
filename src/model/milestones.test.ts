/**
 * Milestone schedule guarantees.
 *
 * The MSA is the governing document: it post-dates the RFP and all four
 * corrigendums and wins wherever they conflict. These assertions pin the
 * numbers read off the signed MSA and the date arithmetic derived from its
 * time anchors.
 */

import { describe, expect, it } from 'vitest';
import {
  buildAnchors,
  deriveDate,
  deriveMilestones,
  milestones as data,
} from './milestones';

const NONE = { dates: {}, paid: {} };
const AS_OF = '2026-08-20';
const anchors = () => buildAnchors(data, data.assumedT4);

describe('payment schedule integrity', () => {
  it('carries all 29 MSA payment milestones', () => {
    expect(data.payments).toHaveLength(29);
    expect(data.payments[0].id).toBe('M1');
    expect(data.payments[28].id).toBe('M29');
  });

  it('percentages total exactly 100% of TCV', () => {
    const total = data.payments.reduce(
      (a, m) => a + (m.pctOfTcv ?? 0) * (m.times ?? 0),
      0,
    );
    expect(total).toBeCloseTo(1, 6);
  });

  it('amounts total the contract value', () => {
    const total = data.payments.reduce((a, m) => a + (m.amountInclGst ?? 0), 0);
    expect(total).toBeCloseTo(20_989_199_999, 0);
    expect(total).toBeCloseTo(data.checksums.printedCheck, 0);
  });

  it('matches the percentages read off the signed MSA pages', () => {
    const pct = (id: string) => data.payments.find((m) => m.id === id)!;
    expect(pct('M2').pctOfTcv).toBeCloseTo(0.025, 6);
    expect(pct('M4').pctOfTcv).toBeCloseTo(0.0225, 6);
    expect(pct('M4').times).toBe(24);
    expect(pct('M15').pctOfTcv).toBeCloseTo(0.04, 6);
    expect(pct('M19').pctOfTcv).toBeCloseTo(0.04, 6);
    expect(pct('M26').pctOfTcv).toBeCloseTo(0.007, 6);
    expect(pct('M26').times).toBe(20);
  });

  it('carries the 321 purchase-order line items', () => {
    expect(data.poItems).toHaveLength(321);
  });
});

describe('time anchors', () => {
  it('resolves the whole chain T through T6', () => {
    const a = anchors();
    expect(a.T).toBe('2026-05-12');
    expect(a.T1).toBe('2026-08-10');
    expect(a.T2).toBe('2027-02-06');
    expect(a.T3).toBe('2027-05-06'); // T2 + 3 months
    expect(a.T4).toBe(data.assumedT4);
    expect(a.T5).toBe('2027-04-12'); // T4 + 2 months, per the MSA
    expect(a.T6).toBe('2027-05-12'); // T5 + 1 month
  });

  it('applies T5 = T4 + 2 months, not the superseded RFP + 3 months', () => {
    // RFP Vol.1 said T4 + 3 months; Corrigendum 3 amended it and the MSA carried
    // the amendment. A 3-month offset here would mean the RFP had won.
    const a = buildAnchors(data, '2027-01-01');
    expect(a.T5).toBe('2027-03-01');
    expect(a.T6).toBe('2027-04-01');
  });

  it('moves everything downstream when T4 changes', () => {
    const a = buildAnchors(data, '2027-06-01');
    expect(a.T5).toBe('2027-08-01');
    expect(a.T6).toBe('2027-09-01');
  });
});

describe('timeline parsing', () => {
  const a = anchors();

  it('reads a plain offset', () => {
    expect(deriveDate('T + 4 weeks', a).date).toBe('2026-06-09');
    expect(deriveDate('T1 + 4 months', a).date).toBe('2026-12-10');
  });

  it('uses the last clause that resolves, not simply the last clause', () => {
    // M2: the trailing clause is a note about ABG validity, not an anchor.
    expect(deriveDate('T + 4 weeks; ABG validity 8 months', a).date).toBe('2026-06-09');
  });

  it('takes the operative anchor when a cell defines several', () => {
    // M28 is earned at T5, not at T4.
    expect(deriveDate('T4 = handover of new CR; T5 = T4 + 2 months', a).date).toBe(a.T5);
  });

  it('evaluates an anchor definition by its right-hand side', () => {
    expect(deriveDate('T3 = T2 + 3 months', a).date).toBe('2027-05-06');
  });

  it('handles the O&M phrasing', () => {
    expect(deriveDate('~5 years post Go-Live of Track 2', a).date).toBe('2032-02-06');
  });
});

describe('derived milestones', () => {
  const rows = deriveMilestones(data, NONE, AS_OF);

  it('leaves no milestone undated', () => {
    const undated = rows.filter((r) => !r.date);
    expect(undated.map((r) => r.id)).toEqual([]);
  });

  it('dates the New CCC milestones off T4', () => {
    const a = anchors();
    expect(rows.find((r) => r.id === 'M28')!.date).toBe(a.T5);
    expect(rows.find((r) => r.id === 'M29')!.date).toBe(a.T6);
    expect(rows.find((r) => r.id === 'M28')!.fromT4).toBe(true);
  });

  it('cumulates to 100% by the final milestone', () => {
    expect(rows[rows.length - 1].cumulativePct).toBeCloseTo(1, 6);
  });

  it('marks a hand-set date as modified without losing the source date', () => {
    const m28 = deriveMilestones(data, { ...NONE, dates: { M28: '2028-01-01' } }, AS_OF).find(
      (r) => r.id === 'M28',
    )!;
    expect(m28.date).toBe('2028-01-01');
    expect(m28.dateModified).toBe(true);
    expect(m28.sourceDate).toBe(anchors().T5);
  });

  it('classifies status against the as-of date', () => {
    const r = deriveMilestones(data, { ...NONE, paid: { M2: true } }, AS_OF);
    expect(r.find((x) => x.id === 'M2')!.status).toBe('Paid');
    expect(r.find((x) => x.id === 'M1')!.status).toBe('Due'); // 12 May 2026, past
    expect(r.find((x) => x.id === 'M26')!.status).toBe('Upcoming'); // 2032
  });
});
