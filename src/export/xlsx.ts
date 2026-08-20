/**
 * Excel export.
 *
 * Mirrors the layout of the source workbooks so the output drops into existing
 * review flows, but written from this platform's engine — which means the GST
 * columns are correctly aligned, unlike 'OPEX Summary'!CF/CG in the source.
 */

import * as XLSX from 'xlsx';
import type { Baseline, Scenario, ScenarioResult } from '../model/types';
import { DEFAULT_GLOBALS } from '../model/engine';
import { deriveRow, EMPTY_ENTRY, type ChangeOrder, type JcrEntry } from '../store/jcr';

type Row = (string | number | null)[];

const MONEY = '#,##0.00';
const PCTF = '0.0%';

function sheet(rows: Row[], widths: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = widths.map((w) => ({ wch: w }));
  // Apply a currency format to every numeric cell beyond the first column.
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.t === 'n' && !Number.isInteger(cell.v * 1000)) cell.z = MONEY;
      else if (cell && cell.t === 'n' && c > 0 && Math.abs(cell.v) >= 1000) cell.z = MONEY;
    }
  }
  return ws;
}

const YRS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'];

export function buildWorkbook(
  baseline: Baseline,
  scenario: Scenario,
  result: ScenarioResult,
  jcr: { asOf: string; entries: Record<string, JcrEntry>; changeOrders: ChangeOrder[] },
  compare?: { name: string; result: ScenarioResult },
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const g = result.globals;
  const now = new Date();

  /* ------------------------------------------------- Cover & Assumptions */
  const ov = scenario.overrides;
  const assumptions: Row[] = [
    ['MUMBAI CITY SURVEILLANCE — PHASE III'],
    ['Job Cost Report — 6-Year Expense Model'],
    [],
    ['Scenario', scenario.name],
    ['Note', scenario.note || '—'],
    ['Generated', now.toLocaleString('en-IN')],
    ['Source workbooks', baseline.meta.sources.join('; ')],
    [],
    ['ASSUMPTIONS — DEVIATIONS FROM THE TENDERED BOQ'],
    ['Lever', 'This scenario', 'As tendered', 'Changed'],
    ['GST rate', g.gstRate, DEFAULT_GLOBALS.gstRate, g.gstRate !== DEFAULT_GLOBALS.gstRate ? 'YES' : ''],
    [
      'Additional inflation p.a.',
      g.inflationDelta,
      DEFAULT_GLOBALS.inflationDelta,
      g.inflationDelta !== 0 ? 'YES' : '',
    ],
    ['CAPEX contingency', g.capexContingency, 0, g.capexContingency !== 0 ? 'YES' : ''],
    ['OPEX contingency', g.opexContingency, 0, g.opexContingency !== 0 ? 'YES' : ''],
    [
      'Track 2 start year',
      g.track2StartYear,
      DEFAULT_GLOBALS.track2StartYear,
      g.track2StartYear !== 2 ? 'YES' : '',
    ],
    [
      'Overhead basis',
      g.overheadMode === 'lock50cr' ? 'Locked at Rs.50 Cr' : 'Bottom-up (16 lines)',
      'Bottom-up (16 lines)',
      g.overheadMode !== 'bottomUp' ? 'YES' : '',
    ],
    [
      'CAPEX recognition',
      g.capexPhasing.map((p) => `${(p * 100).toFixed(0)}%`).join(' / '),
      '100% / 0% / 0% / 0% / 0% / 0%',
      g.capexPhasing[0] !== 1 ? 'YES' : '',
    ],
    [],
    ['SCHEDULE MULTIPLIERS'],
    ...(Object.entries(ov.scheduleMul).filter(([, v]) => v !== 1).length
      ? Object.entries(ov.scheduleMul)
          .filter(([, v]) => v !== 1)
          .map(([id, v]): Row => [id, v])
      : [['(none — all schedules at tendered value)'] as Row]),
    [],
    ['LINE-ITEM OVERRIDES'],
    ['Item', 'Description', 'Tendered', 'This scenario'],
    ...(Object.keys(ov.itemOverride).length
      ? result.byItem
          .filter((i) => i.modified)
          .map((i): Row => [i.id, i.description, i.baselineExGst, i.exGst])
      : [['(none)'] as Row]),
    [],
    ['SOURCE DATA QUALITY NOTES'],
    ...baseline.dataQuality.flatMap((d): Row[] => [
      [d.severity.toUpperCase(), d.summary],
      ['', d.where],
      ['', d.detail],
      [],
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, sheet(assumptions, [30, 46, 26, 12]), 'Cover & Assumptions');

  /* --------------------------------------------------- Executive Summary */
  const t = result.totals;
  const exec: Row[] = [
    ['EXECUTIVE SUMMARY', scenario.name],
    ['All figures in INR unless stated'],
    [],
    ['Cost block', ...YRS, 'Total (6 Yrs)', 'Rs. in Crore'],
    ['CAPEX (one-time)', ...result.byYear.map((y) => y.capex), t.capex, t.capex / 1e7],
    ['OPEX (recurring)', ...result.byYear.map((y) => y.opex), t.opex, t.opex / 1e7],
    ['Overhead (Schedule P)', ...result.byYear.map((y) => y.overhead), t.overhead, t.overhead / 1e7],
    ['Total excl. GST', ...result.byYear.map((y) => y.exGst), t.exGst, t.exGst / 1e7],
    [`GST @ ${(g.gstRate * 100).toFixed(1)}%`, ...result.byYear.map((y) => y.gst), t.gst, t.gst / 1e7],
    [
      'Total incl. GST',
      ...result.byYear.map((y) => y.inclGst),
      t.inclGst,
      t.inclGst / 1e7,
    ],
    [],
    ['CONTRACT RECONCILIATION'],
    ['Total Contract Value (incl. GST)', baseline.contract.tcvInclGst],
    ['This model (incl. GST)', t.inclGst],
    ['Unreconciled gap', t.tcvGap],
    [
      '',
      'Inherited from the source JCR, which flags it as an open item; not introduced by this model.',
    ],
  ];
  XLSX.utils.book_append_sheet(wb, sheet(exec, [26, 18, 18, 18, 18, 18, 18, 20, 14]), 'Executive Summary');

  /* ---------------------------------------------------- Schedule Summary */
  const summary: Row[] = [
    ['SCHEDULE SUMMARY', scenario.name],
    [],
    [
      'Schedule',
      'Description',
      'Block',
      'Track',
      ...YRS,
      'Total excl. GST',
      `GST @ ${(g.gstRate * 100).toFixed(1)}%`,
      'Total incl. GST',
      'As tendered',
      'Variance',
    ],
    ...result.bySchedule.map((s): Row => [
      s.id,
      s.name,
      s.kind.toUpperCase(),
      s.track,
      ...s.years,
      s.exGst,
      s.gst,
      s.inclGst,
      s.baselineExGst,
      s.exGst - s.baselineExGst,
    ]),
    [
      'TOTAL',
      '',
      '',
      '',
      ...result.byYear.map((y) => y.exGst),
      t.exGst,
      t.gst,
      t.inclGst,
      baseline.checksums.projectTotalExGst,
      t.exGst - baseline.checksums.projectTotalExGst,
    ],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    sheet(summary, [10, 44, 10, 10, 16, 16, 16, 16, 16, 16, 18, 16, 18, 18, 16]),
    'Schedule Summary',
  );

  /* ------------------------------------------------------- CAPEX Detail */
  const capexRows: Row[] = [
    ['CAPEX — LINE-ITEM DETAIL', scenario.name],
    [],
    [
      'Schedule',
      '#',
      'Description',
      'Qty',
      'Unit',
      'Phase',
      'R&R',
      'Category',
      'OEM',
      'Unit rate',
      'Amount excl. GST',
      'GST',
      'Amount incl. GST',
      'As tendered',
    ],
    ...baseline.capexItems.map((it): Row => {
      const res = result.byItem.find((x) => x.id === it.id)!;
      const o = scenario.overrides.itemOverride[it.id];
      return [
        it.schedule,
        it.num,
        it.description,
        o?.qty ?? it.qty,
        it.unit,
        it.phase,
        it.rr,
        it.category,
        it.oem,
        o?.unitRate ?? it.unitRate,
        res.exGst,
        res.gst,
        res.exGst + res.gst,
        it.amountExGst,
      ];
    }),
    ['', '', 'TOTAL', null, '', '', '', '', '', null, t.capex, t.capex * g.gstRate, t.capex * (1 + g.gstRate), baseline.checksums.capexExGst],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    sheet(capexRows, [10, 6, 54, 9, 8, 10, 8, 11, 14, 14, 18, 16, 18, 18]),
    'CAPEX Detail',
  );

  /* -------------------------------------------------------- OPEX Detail */
  const opexRows: Row[] = [
    ['OPEX — LINE-ITEM DETAIL', scenario.name],
    [],
    [
      'Schedule',
      'Track',
      '#',
      'Description',
      'OEM',
      ...YRS,
      'Total excl. GST',
      'GST',
      'Total incl. GST',
      'As tendered',
    ],
    ...baseline.opexItems.map((it): Row => {
      const res = result.byItem.find((x) => x.id === it.id)!;
      return [
        it.schedule,
        it.track,
        it.num,
        it.description,
        it.oem,
        ...res.years,
        res.exGst,
        res.gst,
        res.exGst + res.gst,
        it.years.reduce((a, b) => a + b, 0),
      ];
    }),
    [
      '',
      '',
      '',
      'TOTAL',
      '',
      ...result.byYear.map((y) => y.opex),
      t.opex,
      t.opex * g.gstRate,
      t.opex * (1 + g.gstRate),
      baseline.checksums.opexExGst,
    ],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    sheet(opexRows, [10, 9, 6, 52, 14, 16, 16, 16, 16, 16, 16, 18, 16, 18, 18]),
    'OPEX Detail',
  );

  /* ------------------------------------------- OPEX Monthly (M1-M12 x 6) */
  const monthHdr: Row = ['Schedule', 'Description', 'Track'];
  for (const y of YRS) for (let m = 1; m <= 12; m++) monthHdr.push(`${y} M${m}`);
  monthHdr.push('Total excl. GST', 'GST', 'Total incl. GST');
  const monthly: Row[] = [
    ['OPEX — MONTHLY BREAKDOWN', scenario.name],
    ['Source BOQ gives annual figures only; monthly = annual / 12, evenly distributed.'],
    [],
    monthHdr,
    ...result.bySchedule
      .filter((s) => s.kind !== 'capex')
      .map((s): Row => {
        const cells: Row = [s.id, s.name, s.track];
        for (const yv of s.years) for (let m = 0; m < 12; m++) cells.push(yv / 12);
        cells.push(s.exGst, s.gst, s.inclGst);
        return cells;
      }),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    sheet(monthly, [10, 44, 10, ...new Array(72).fill(14), 18, 16, 18]),
    'OPEX Monthly',
  );

  /* ---------------------------------------------------- Overhead Detail */
  const ovh: Row[] = [
    ['OVERHEAD (SCHEDULE P) — LINE-ITEM DETAIL', scenario.name],
    [
      g.overheadMode === 'lock50cr'
        ? 'Locked: the block is rescaled to Rs.50.00 Cr, matching Schedule P of the Phase III JCR tracker.'
        : 'Bottom-up: monthly Year 1 base x 12, escalated year on year at each line’s own rate.',
    ],
    [],
    ['Sr', 'Description', 'Monthly Yr 1', 'Escalation Y1→Y2', ...YRS, 'Total', 'As tendered'],
    ...baseline.overheadItems.map((it): Row => {
      const res = result.byItem.find((x) => x.id === it.id)!;
      const o = scenario.overrides.itemOverride[it.id];
      return [
        it.sr,
        it.description,
        o?.monthlyY1 ?? it.monthlyY1,
        (o?.escPattern ?? it.escPattern)[0],
        ...res.years,
        res.exGst,
        it.sourceYears.reduce((a, b) => a + b, 0),
      ];
    }),
    [
      '',
      'TOTAL',
      null,
      null,
      ...result.bySchedule.find((s) => s.id === 'P')!.years,
      t.overhead,
      baseline.checksums.overheadExGst,
    ],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    sheet(ovh, [6, 46, 16, 18, 16, 16, 16, 16, 16, 16, 18, 18]),
    'Overhead Detail',
  );

  /* ------------------------------------------------------------ JCR */
  const budgetFor = new Map<string, number>();
  for (const c of baseline.jcrCostCodes) {
    const base = c.code.split('-')[0];
    const siblings = baseline.jcrCostCodes.filter((x) => x.code.split('-')[0] === base);
    const sched = result.bySchedule.find((s) => s.id === base)?.exGst ?? 0;
    const denom = siblings.reduce((a, x) => a + x.budgetExGst, 0);
    budgetFor.set(c.code, denom > 0 ? sched * (c.budgetExGst / denom) : sched);
  }
  const approvedFor = (code: string) =>
    jcr.changeOrders
      .filter((c) => c.costCode === code && c.status === 'HPC Approved')
      .reduce((a, c) => a + c.budgetImpact, 0);

  const jcrRows = baseline.jcrCostCodes.map((c) =>
    deriveRow(
      c.code,
      c.description ?? '',
      c.track ?? '',
      budgetFor.get(c.code) ?? 0,
      jcr.entries[c.code] ?? EMPTY_ENTRY,
      approvedFor(c.code),
    ),
  );

  const jcrSheet: Row[] = [
    ['JOB COST REPORT', scenario.name],
    [`As of ${jcr.asOf}`],
    [],
    [
      'Cost code',
      'Description',
      'Track',
      'Original budget',
      'Approved COs',
      'Revised budget',
      'Committed',
      '% Committed',
      'Actual to date',
      '% Complete',
      'Est. cost to complete',
      'Est. final cost',
      'Variance',
      'Variance %',
    ],
    ...jcrRows.map((x): Row => [
      x.code,
      x.description,
      x.track,
      x.originalBudget,
      x.approvedCos,
      x.revisedBudget,
      x.committed,
      x.pctCommitted,
      x.actual,
      x.percentComplete,
      x.estToComplete,
      x.estFinalCost,
      x.variance,
      x.variancePct,
    ]),
  ];
  const jws = sheet(jcrSheet, [12, 44, 10, 18, 16, 18, 16, 12, 18, 12, 20, 18, 16, 12]);
  // Percentage columns
  const jr = XLSX.utils.decode_range(jws['!ref']!);
  for (let r = 4; r <= jr.e.r; r++) {
    for (const c of [7, 9, 13]) {
      const cell = jws[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.z = PCTF;
    }
  }
  XLSX.utils.book_append_sheet(wb, jws, 'JCR');

  if (jcr.changeOrders.length) {
    const co: Row[] = [
      ['CHANGE ORDER LOG'],
      [],
      [
        'CR #',
        'Date raised',
        'Description',
        'Cost code',
        'Budget impact',
        'Status',
        'PIC review',
        'HPC approval',
        'Notes',
      ],
      ...jcr.changeOrders.map((c): Row => [
        c.cr,
        c.dateRaised,
        c.description,
        c.costCode,
        c.budgetImpact,
        c.status,
        c.picDate,
        c.hpcDate,
        c.note,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, sheet(co, [10, 14, 50, 12, 18, 14, 14, 14, 30]), 'Change Orders');
  }

  /* ------------------------------------------------- Scenario comparison */
  if (compare) {
    const c = compare.result;
    const cmp: Row[] = [
      ['SCENARIO COMPARISON'],
      [],
      ['', scenario.name, compare.name, 'Difference', '%'],
      ...(
        [
          ['CAPEX', t.capex, c.totals.capex],
          ['OPEX', t.opex, c.totals.opex],
          ['Overhead', t.overhead, c.totals.overhead],
          ['Total excl. GST', t.exGst, c.totals.exGst],
          ['GST', t.gst, c.totals.gst],
          ['Total incl. GST', t.inclGst, c.totals.inclGst],
        ] as [string, number, number][]
      ).map(([k, a, bv]): Row => [k, a, bv, a - bv, bv === 0 ? 0 : (a - bv) / bv]),
      [],
      ['By year — total excl. GST'],
      ['Year', scenario.name, compare.name, 'Difference'],
      ...result.byYear.map((y, i): Row => [
        `Year ${y.year}`,
        y.exGst,
        c.byYear[i].exGst,
        y.exGst - c.byYear[i].exGst,
      ]),
      [],
      ['By schedule — excl. GST'],
      ['Schedule', 'Description', scenario.name, compare.name, 'Difference'],
      ...result.bySchedule.map((s, i): Row => [
        s.id,
        s.name,
        s.exGst,
        c.bySchedule[i].exGst,
        s.exGst - c.bySchedule[i].exGst,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, sheet(cmp, [22, 44, 20, 20, 20, 12]), 'Scenario Compare');
  }

  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename, { compression: true });
}
