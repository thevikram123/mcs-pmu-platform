/**
 * MCS Phase 3 cost engine.
 *
 * Pure functions over the baseline extracted from the source workbooks. The
 * contract this file must honour: `computeScenario(baseline, emptyOverrides())`
 * reproduces the workbooks to the rupee. engine.test.ts enforces that.
 *
 * Why inflation is a *delta*: the OPEX year-wise figures in the source BOQ are
 * hardcoded values, not formulas, and they follow four different patterns
 * (flat repeat, Track-2 zero-in-Year-1, a Year 1->2 warranty step-down in J1,
 * and compounded escalation in L/O1/O2). Re-deriving them from a single
 * back-solved rate would destroy the step and the irregularities. So the
 * inflation control compounds *on top of* the given values, and at 0 the source
 * numbers survive untouched.
 */

import type {
  Baseline,
  Globals,
  GroupResult,
  ItemResult,
  Overrides,
  Schedule,
  ScenarioResult,
  ScheduleId,
  ScheduleResult,
  YearRow,
} from './types';

export const YEARS = 6;

export const DEFAULT_GLOBALS: Globals = {
  gstRate: 0.18,
  inflationDelta: 0,
  capexContingency: 0,
  opexContingency: 0,
  track2StartYear: 2,
  overheadMode: 'bottomUp',
  capexPhasing: [1, 0, 0, 0, 0, 0],
};

export function emptyOverrides(): Overrides {
  return { globals: {}, scheduleMul: {}, gstBySchedule: {}, itemOverride: {} };
}

export function cloneOverrides(o: Overrides): Overrides {
  return structuredClone(o);
}

/** True when the scenario deviates from the source workbooks in any way. */
export function isPristine(o: Overrides): boolean {
  return (
    Object.keys(o.globals).length === 0 &&
    Object.keys(o.scheduleMul).length === 0 &&
    Object.keys(o.gstBySchedule).length === 0 &&
    Object.keys(o.itemOverride).length === 0
  );
}

export function countChanges(o: Overrides): number {
  return (
    Object.keys(o.globals).length +
    Object.values(o.scheduleMul).filter((v) => v !== 1).length +
    Object.keys(o.gstBySchedule).length +
    Object.keys(o.itemOverride).length
  );
}

const zeros = () => new Array<number>(YEARS).fill(0);

/**
 * Re-anchor a Track 2 vector to a different start year.
 *
 * Source Track 2 vectors look like [0, v2, v3, v4, v5, v6] — nothing in Year 1.
 * Moving the start later truncates the tail (spend pushed past Year 6 falls out
 * of the 6-year horizon and the total drops); moving it earlier holds the final
 * year's value to fill the horizon.
 */
export function reanchor(years: number[], startYear: number): number[] {
  const first = years.findIndex((v) => v !== 0);
  if (first <= 0) return years.slice(); // no leading zero: nothing to re-anchor
  const live = years.slice(first);
  const out = zeros();
  const offset = Math.max(0, Math.min(YEARS - 1, startYear - 1));
  for (let i = 0; offset + i < YEARS; i++) {
    out[offset + i] = live[Math.min(i, live.length - 1)];
  }
  return out;
}

function resolveGlobals(o: Overrides): Globals {
  return { ...DEFAULT_GLOBALS, ...o.globals };
}

const mul = (o: Overrides, id: ScheduleId) => o.scheduleMul[id] ?? 1;
const gstFor = (o: Overrides, id: ScheduleId, g: Globals) => o.gstBySchedule[id] ?? g.gstRate;

/** Compound the global inflation delta across the horizon: year 1 is unaffected. */
function inflationFactors(delta: number): number[] {
  return Array.from({ length: YEARS }, (_, i) => (1 + delta) ** i);
}

export function computeScenario(baseline: Baseline, overrides: Overrides): ScenarioResult {
  const g = resolveGlobals(overrides);
  const infl = inflationFactors(g.inflationDelta);
  const items: ItemResult[] = [];

  const schedIndex = new Map<ScheduleId, Schedule>(baseline.schedules.map((s) => [s.id, s]));
  const acc = new Map<ScheduleId, number[]>();
  const addTo = (id: ScheduleId, years: number[]) => {
    const cur = acc.get(id) ?? zeros();
    for (let i = 0; i < YEARS; i++) cur[i] += years[i];
    acc.set(id, cur);
  };

  // ------------------------------------------------------------------ CAPEX
  const phasing = g.capexPhasing;
  for (const it of baseline.capexItems) {
    const ov = overrides.itemOverride[it.id];
    const excluded = ov?.excluded === true;
    const qty = ov?.qty ?? it.qty;
    const rate = ov?.unitRate ?? it.unitRate;
    const amount = excluded
      ? 0
      : qty * rate * mul(overrides, it.schedule) * (1 + g.capexContingency);
    const years = phasing.map((share) => amount * share);
    addTo(it.schedule, years);
    items.push({
      id: it.id,
      schedule: it.schedule,
      kind: 'capex',
      description: it.description,
      years,
      exGst: amount,
      gst: amount * gstFor(overrides, it.schedule, g),
      baselineExGst: it.amountExGst,
      modified: ov != null,
      excluded,
    });
  }

  // ------------------------------------------------------------------- OPEX
  for (const it of baseline.opexItems) {
    const ov = overrides.itemOverride[it.id];
    const excluded = ov?.excluded === true;
    let years = (ov?.years ?? it.years).slice();
    if (it.track === 'Track 2') years = reanchor(years, g.track2StartYear);
    const m = mul(overrides, it.schedule) * (1 + g.opexContingency);
    years = years.map((v, i) => (excluded ? 0 : v * infl[i] * m));
    addTo(it.schedule, years);
    const exGst = years.reduce((a, b) => a + b, 0);
    items.push({
      id: it.id,
      schedule: it.schedule,
      kind: 'opex',
      description: it.description,
      years,
      exGst,
      gst: exGst * gstFor(overrides, it.schedule, g),
      baselineExGst: it.years.reduce((a, b) => a + b, 0),
      modified: ov != null,
      excluded,
    });
  }

  // --------------------------------------------------------------- Overhead
  // Driver-based in its source: monthly Year 1 base x 12, then a per-line
  // escalation pattern (10%/yr rents, 5%/yr salaries, 2% on alternate years for
  // electricity, 0% for the flat lines).
  const overheadRaw: { id: string; description: string; years: number[]; base: number; ov: boolean; excluded: boolean }[] = [];
  for (const it of baseline.overheadItems) {
    const ov = overrides.itemOverride[it.id];
    const excluded = ov?.excluded === true;
    const monthly = ov?.monthlyY1 ?? it.monthlyY1;
    const esc = ov?.escPattern ?? it.escPattern;
    const years = zeros();
    years[0] = monthly * 12;
    for (let i = 1; i < YEARS; i++) years[i] = years[i - 1] * (1 + (esc[i - 1] ?? 0));
    const m = mul(overrides, 'P');
    const adjusted = years.map((v, i) => (excluded ? 0 : v * infl[i] * m));
    overheadRaw.push({
      id: it.id,
      description: it.description,
      years: adjusted,
      base: it.sourceYears.reduce((a, b) => a + b, 0),
      ov: ov != null,
      excluded,
    });
  }

  // In lock mode the block is scaled to land on exactly Rs.50 Cr, preserving each
  // line's relative weight. Sliders then change the mix, not the total.
  const overheadBottomUp = overheadRaw.reduce((s, r) => s + r.years.reduce((a, b) => a + b, 0), 0);
  const lockScale =
    g.overheadMode === 'lock50cr' && overheadBottomUp > 0
      ? baseline.checksums.overheadLockTarget / overheadBottomUp
      : 1;

  for (const r of overheadRaw) {
    const years = r.years.map((v) => v * lockScale);
    addTo('P', years);
    const exGst = years.reduce((a, b) => a + b, 0);
    items.push({
      id: r.id,
      schedule: 'P',
      kind: 'overhead',
      description: r.description,
      years,
      exGst,
      gst: exGst * gstFor(overrides, 'P', g),
      baselineExGst: r.base,
      modified: r.ov,
      excluded: r.excluded,
    });
  }

  // ---------------------------------------------------------------- rollups
  const bySchedule: ScheduleResult[] = baseline.schedules.map((s) => {
    const years = acc.get(s.id) ?? zeros();
    const exGst = years.reduce((a, b) => a + b, 0);
    const rate = gstFor(overrides, s.id, g);
    return {
      id: s.id,
      name: s.name,
      kind: s.kind,
      track: s.track,
      years,
      exGst,
      gst: exGst * rate,
      inclGst: exGst * (1 + rate),
      baselineExGst: s.sourceTotal,
      itemCount: s.itemCount,
    };
  });

  const byYear: YearRow[] = Array.from({ length: YEARS }, (_, y) => {
    let capex = 0;
    let opex = 0;
    let overhead = 0;
    let gst = 0;
    for (const s of bySchedule) {
      const v = s.years[y];
      if (s.kind === 'capex') capex += v;
      else if (s.kind === 'opex') opex += v;
      else overhead += v;
      gst += v * gstFor(overrides, s.id, g);
    }
    const exGst = capex + opex + overhead;
    return { year: y + 1, capex, opex, overhead, exGst, gst, inclGst: exGst + gst };
  });

  const sum = (k: (s: ScheduleResult) => boolean) =>
    bySchedule.filter(k).reduce((a, s) => a + s.exGst, 0);

  const exGst = bySchedule.reduce((a, s) => a + s.exGst, 0);
  const gst = bySchedule.reduce((a, s) => a + s.gst, 0);
  const inclGst = exGst + gst;

  const totals = {
    capex: sum((s) => s.kind === 'capex'),
    opex: sum((s) => s.kind === 'opex'),
    overhead: sum((s) => s.kind === 'overhead'),
    exGst,
    gst,
    inclGst,
    tcvGap: baseline.contract.tcvInclGst - inclGst,
  };

  const group = (
    keyOf: (i: ItemResult) => string | null,
  ): GroupResult[] => {
    const m = new Map<string, { exGst: number; gst: number }>();
    for (const i of items) {
      const k = keyOf(i);
      if (k == null) continue;
      const cur = m.get(k) ?? { exGst: 0, gst: 0 };
      cur.exGst += i.exGst;
      cur.gst += i.gst;
      m.set(k, cur);
    }
    return [...m.entries()]
      .map(([key, v]) => ({
        key,
        exGst: v.exGst,
        gst: v.gst,
        inclGst: v.exGst + v.gst,
        share: exGst === 0 ? 0 : v.exGst / exGst,
      }))
      .sort((a, b) => b.exGst - a.exGst);
  };

  const capexById = new Map(baseline.capexItems.map((i) => [i.id, i]));
  const opexById = new Map(baseline.opexItems.map((i) => [i.id, i]));
  const dim = (i: ItemResult, f: 'oem' | 'category' | 'phase'): string | null => {
    const src = capexById.get(i.id) ?? opexById.get(i.id);
    return src ? (src[f] ?? 'Unassigned') : null;
  };

  const monthly = byYear.map((r) => new Array(12).fill(r.exGst / 12));

  return {
    globals: g,
    byYear,
    bySchedule,
    byItem: items,
    byTrack: group((i) => schedIndex.get(i.schedule)?.track ?? null),
    byOem: group((i) => (i.kind === 'overhead' ? 'Overhead (no OEM)' : dim(i, 'oem'))),
    byCategory: group((i) => (i.kind === 'overhead' ? 'Overhead' : dim(i, 'category'))),
    byPhase: group((i) => (i.kind === 'overhead' ? 'All phases' : dim(i, 'phase'))),
    totals,
    monthly,
  };
}
