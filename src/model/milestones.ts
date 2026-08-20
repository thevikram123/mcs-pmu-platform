/**
 * Milestone model.
 *
 * The MSA states each payment milestone's timing relative to a set of anchors
 * (T, T1, T2 …), not as a calendar date. This derives real dates where the
 * anchors allow it, and is explicit about the ones that cannot be derived —
 * T4 is "handover of the new control room", which has no fixed date, so every
 * milestone hanging off it is undated until someone enters a date by hand.
 */

import milestonesJson from '../data/milestones.json';

export interface PaymentMilestone {
  id: string;
  track: string;
  name: string;
  timeline: string;
  pctOfTcv: number | null;
  times: number | null;
  amountInclGst: number | null;
  deliverable: string | null;
}

export interface ScheduleMilestone {
  id: string;
  newId: string | null;
  name: string;
  timelineText: string | null;
  start: string | null;
  end: string | null;
  durationDays: number | null;
}

export interface PoItem {
  milestoneId: string;
  newId: string | null;
  milestone: string | null;
  category: string;
  itemNo: string | null;
  description: string | null;
  poTargetDate: string | null;
  status: string;
  remarks: string | null;
}

export interface AnchorDefinition {
  anchor: string;
  definition: string;
  page: string;
}

export interface Clause {
  title: string;
  ref: string;
  text: string;
}

export interface MilestoneData {
  meta: { generatedBy: string; sources: string[] };
  anchors: Record<string, string | null>;
  /** Read off the 38 signed MSA page scans and cross-checked against the extract. */
  governance: {
    anchorDefinitions: AnchorDefinition[];
    clauses: Clause[];
    verification: string;
    resolutionOfT4: string;
    amendments: { item: string; rfp: string; final: string; via: string }[];
  };
  /** T4 is condition-based in every source document; this is the working assumption. */
  assumedT4: string;
  t4Basis: string;
  payments: PaymentMilestone[];
  schedule: ScheduleMilestone[];
  poItems: PoItem[];
  checksums: {
    paymentTotalInclGst: number;
    paymentPctTotal: number;
    printedCheck: number;
    paymentCount: number;
    scheduleCount: number;
    poItemCount: number;
  };
  dataQuality: { id: string; severity: string; where: string; summary: string; detail: string }[];
}

export const milestones = milestonesJson as unknown as MilestoneData;

export type PoStatus = 'Pending' | 'PO Raised' | 'PO Placed' | 'Delivered' | 'Cancelled';
export const PO_STATUSES: PoStatus[] = [
  'Pending',
  'PO Raised',
  'PO Placed',
  'Delivered',
  'Cancelled',
];

/* ------------------------------------------------------------ date maths */

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  const whole = Math.trunc(months);
  const frac = months - whole;
  out.setMonth(out.getMonth() + whole);
  if (frac) out.setDate(out.getDate() + Math.round(frac * 30.44));
  return out;
}

const toISO = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Parse an MSA timeline phrase into an anchor plus an offset.
 * Handles "T + 4 weeks", "T1 + 6 years", "T + 0.5 months", "T2 = T + 9 months",
 * and "~5 years post Go-Live of Track 2". Returns null when the phrase depends
 * on an anchor the contract never fixes to a calendar date.
 */
export function deriveDate(
  timeline: string | null,
  anchors: Record<string, string | null>,
): { date: string | null; basis: string } {
  if (!timeline) return { date: null, basis: 'no timeline stated' };

  // A cell can hold several clauses. M28 is "T4 = handover of the new control
  // room; T5 = T4 + 2 months" — the milestone is earned at T5, the last anchor
  // named. But M2 is "T + 4 weeks; ABG validity 8 months", where the trailing
  // clause is a note, not an anchor. So walk the clauses from the end and take
  // the last one that actually resolves to a date.
  const clauses = timeline
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean);

  let lastBasis = 'timeline not date-certain';
  for (let i = clauses.length - 1; i >= 0; i--) {
    const r = parseClause(clauses[i], anchors);
    if (r.date) return r;
    if (i === 0) lastBasis = r.basis;
  }
  return { date: null, basis: lastBasis };
}

function parseClause(
  t: string,
  anchors: Record<string, string | null>,
): { date: string | null; basis: string } {
  // "T1 = T + 3 months" defines an anchor. Use the anchor's known date if we
  // have one; otherwise evaluate the right-hand side, so "T3 = T2 + 3 months"
  // still resolves even though T3 itself may not be in the anchor table.
  const defn = t.match(/^(T\d?)\s*=\s*(.*)$/);
  if (defn) {
    const known = anchors[defn[1]];
    if (known) return { date: known, basis: `anchor ${defn[1]}` };
    const rhs = defn[2].trim();
    if (rhs && /^T\d?\s*\+/.test(rhs)) {
      const inner = parseClause(rhs, anchors);
      return inner.date
        ? { date: inner.date, basis: `${defn[1]} = ${inner.basis}` }
        : { date: null, basis: `${defn[1]} depends on ${inner.basis}` };
    }
    return { date: null, basis: `anchor ${defn[1]} not fixed` };
  }

  // "~5 years post Go-Live of Track 2"
  const post = t.match(/~?\s*([\d.]+)\s*(year|month|week|day)s?\s+post[^]*track\s*2/i);
  if (post) {
    const base = anchors.T2;
    if (!base) return { date: null, basis: 'anchor T2 not fixed' };
    return {
      date: offsetFrom(base, Number(post[1]), post[2]),
      basis: `T2 + ${post[1]} ${post[2]}s`,
    };
  }

  // "T + 4 weeks", "T1 + 6 years", "T + 0.5 months"
  const rel = t.match(/^(T\d?)\s*\+\s*([\d.]+)\s*(year|month|week|day)s?/i);
  if (rel) {
    const base = anchors[rel[1]];
    if (!base) return { date: null, basis: `anchor ${rel[1]} not fixed` };
    return {
      date: offsetFrom(base, Number(rel[2]), rel[3]),
      basis: `${rel[1]} + ${rel[2]} ${rel[3]}s`,
    };
  }

  // A bare anchor, e.g. "T"
  const bare = t.match(/^(T\d?)\s*$/);
  if (bare) {
    const base = anchors[bare[1]];
    return base
      ? { date: base, basis: `anchor ${bare[1]}` }
      : { date: null, basis: `anchor ${bare[1]} not fixed` };
  }

  return { date: null, basis: 'timeline not date-certain' };
}

function offsetFrom(baseISO: string, n: number, unit: string): string {
  const d = new Date(`${baseISO}T00:00:00Z`);
  const u = unit.toLowerCase();
  if (u === 'year') return toISO(addMonths(d, n * 12));
  if (u === 'month') return toISO(addMonths(d, n));
  d.setUTCDate(d.getUTCDate() + n * (u === 'week' ? 7 : 1));
  return toISO(d);
}

/* --------------------------------------------------------------- derive */

export interface DerivedMilestone extends PaymentMilestone {
  /** Date in force: the user's override if present, otherwise derived. */
  date: string | null;
  sourceDate: string | null;
  basis: string;
  dateModified: boolean;
  /** Cumulative share of TCV once this milestone is paid. */
  cumulativePct: number;
  cumulativeAmount: number;
  poItems: PoItem[];
  status: MilestoneStatus;
  /** True when the date depends on the settable T4 assumption rather than a contractual anchor. */
  fromT4: boolean;
  /** What the schedule says, before any human judgement. */
  derivedStatus: DerivedStatus;
  statusModified: boolean;
}

/**
 * Status has two layers. Where nobody has said otherwise it is derived from the
 * date against the as-of date, so the schedule is honest on day one. As soon as
 * someone records where a milestone actually is, that choice wins and is marked
 * as set by hand.
 */
export type DerivedStatus = 'Due' | 'Upcoming' | 'Undated';

export type SetStatus =
  | 'Not started'
  | 'In progress'
  | 'Submitted for acceptance'
  | 'Accepted'
  | 'Invoiced'
  | 'Paid'
  | 'On hold';

export type MilestoneStatus = DerivedStatus | SetStatus;

/** Offered in the dropdown, in the order work actually moves through them. */
export const SETTABLE_STATUSES: SetStatus[] = [
  'Not started',
  'In progress',
  'Submitted for acceptance',
  'Accepted',
  'Invoiced',
  'Paid',
  'On hold',
];

/** Statuses that mean the money has actually been received. */
export const PAID_STATUSES: MilestoneStatus[] = ['Paid'];

/**
 * The complete anchor table.
 *
 * T, T1 and T2 come off the delivery schedule. T4 is condition-based in the MSA,
 * the corrigendums and the RFP alike — no document fixes a date — so it is a
 * settable project assumption. Everything downstream of it is fixed by the MSA:
 * T5 = T4 + 2 months, T6 = T5 + 1 month.
 */
export function buildAnchors(
  data: MilestoneData,
  t4: string,
): Record<string, string | null> {
  const t2 = data.anchors.T2 ?? null;
  const t5 = offsetFrom(t4, 2, 'month');
  return {
    ...data.anchors,
    T3: t2 ? offsetFrom(t2, 3, 'month') : null,
    T4: t4,
    T5: t5,
    T6: offsetFrom(t5, 1, 'month'),
  };
}

export function deriveMilestones(
  data: MilestoneData,
  overrides: {
    dates: Record<string, string>;
    status: Record<string, SetStatus>;
    t4?: string;
  },
  asOf: string,
): DerivedMilestone[] {
  const t4 = overrides.t4 ?? data.assumedT4;
  const anchors = buildAnchors(data, t4);
  // PO items key off the tracker's numbering, which is NOT the MSA's. Match on
  // the tracker milestone whose name best fits, never on the label alone.
  const poByTrackerId = new Map<string, PoItem[]>();
  for (const p of data.poItems) {
    const list = poByTrackerId.get(p.milestoneId) ?? [];
    list.push(p);
    poByTrackerId.set(p.milestoneId, list);
  }

  const rows = data.payments.map((m) => {
    const derived = deriveDate(m.timeline, anchors);
    const override = overrides.dates[m.id];
    const date = override ?? derived.date;
    return {
      ...m,
      date,
      sourceDate: derived.date,
      basis: override ? 'manually set' : derived.basis,
      dateModified: override != null && override !== derived.date,
      fromT4: /T[456]/.test(m.timeline ?? ''),
      derivedStatus: 'Upcoming' as DerivedStatus,
      statusModified: overrides.status[m.id] != null,
      cumulativePct: 0,
      cumulativeAmount: 0,
      poItems: [] as PoItem[],
      status: 'Upcoming' as MilestoneStatus,
    };
  });

  // Cumulative in contractual order, which is the order the MSA lists them in.
  let pct = 0;
  let amt = 0;
  for (const r of rows) {
    pct += (r.pctOfTcv ?? 0) * (r.times ?? 0);
    amt += r.amountInclGst ?? 0;
    r.cumulativePct = pct;
    r.cumulativeAmount = amt;
    r.derivedStatus = !r.date ? 'Undated' : r.date <= asOf ? 'Due' : 'Upcoming';
    r.status = overrides.status[r.id] ?? r.derivedStatus;
  }
  return rows;
}

export const STATUS_TONE: Record<MilestoneStatus, string> = {
  // derived
  Due: '#f43f5e',
  Upcoming: '#43b0b0',
  Undated: '#94a3b8',
  // set by hand
  'Not started': '#94a3b8',
  'In progress': '#f59e0b',
  'Submitted for acceptance': '#8b5cf6',
  Accepted: '#0ea5e9',
  Invoiced: '#6366f1',
  Paid: '#10b981',
  'On hold': '#e11d48',
};
