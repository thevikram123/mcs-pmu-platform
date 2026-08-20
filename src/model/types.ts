/** Domain types for the MCS Phase 3 cost model. Mirrors src/data/baseline.json. */

export type Track = 'Track 1' | 'Track 2' | 'Shared';
export type Kind = 'capex' | 'opex' | 'overhead';
export type ScheduleId = string; // 'A'..'G' | 'H1'..'O2' | 'P'

export interface CapexItem {
  id: string;
  row: number;
  schedule: ScheduleId;
  num: string | null;
  description: string;
  qty: number;
  unit: string | null;
  phase: string | null;
  rr: string | null;
  category: string | null;
  oem: string;
  unitRate: number;
  amountExGst: number;
}

export interface OpexItem {
  id: string;
  row: number;
  schedule: ScheduleId;
  track: Track;
  num: string | null;
  description: string;
  qty: number | null;
  unit: string | null;
  phase: string | null;
  rr: string | null;
  category: string | null;
  oem: string;
  /** Six annual figures exactly as given in the source BOQ. */
  years: number[];
  /** Indices where the source held the text "NA" rather than a number. */
  naYears: number[];
}

export interface OverheadItem {
  id: string;
  row: number;
  schedule: 'P';
  sr: number | null;
  description: string;
  monthlyY1: number;
  /** Year-on-year escalation recovered from the source, 5 entries (Y1→Y2 … Y5→Y6). */
  escPattern: number[];
  sourceYears: number[];
}

export interface Schedule {
  id: ScheduleId;
  name: string;
  kind: Kind;
  track: Track;
  itemCount: number;
  sourceTotal: number;
  sourceYears?: number[];
}

export interface JcrCostCode {
  code: string;
  description: string | null;
  track: string | null;
  kind: Kind;
  budgetExGst: number;
}

export interface Vendor {
  oem: string;
  kind: 'capex' | 'opex';
  budgetExGst: number;
}

export interface DataQualityNote {
  id: string;
  severity: 'defect' | 'anomaly';
  where: string;
  summary: string;
  detail: string;
}

export interface Baseline {
  meta: { generatedBy: string; sources: string[]; horizonYears: number; currency: string };
  projectFacts: Record<string, string>;
  contract: { tcvInclGst: number; boqBudgetInclGst: number };
  schedules: Schedule[];
  capexItems: CapexItem[];
  opexItems: OpexItem[];
  overheadItems: OverheadItem[];
  jcrCostCodes: JcrCostCode[];
  vendors: Vendor[];
  checksums: {
    capexExGst: number;
    opexExGst: number;
    overheadExGst: number;
    overheadLockTarget: number;
    overheadYear1: number;
    projectTotalExGst: number;
    gstRate: number;
  };
  dataQuality: DataQualityNote[];
}

// ---------------------------------------------------------------- overrides

export type OverheadMode = 'bottomUp' | 'lock50cr';

export interface Globals {
  /** GST rate applied to every ex-GST figure. Source default 0.18. */
  gstRate: number;
  /**
   * Additional inflation compounded on top of the escalation already baked into
   * the source figures. 0 reproduces the workbook exactly.
   */
  inflationDelta: number;
  capexContingency: number;
  opexContingency: number;
  /** Year (1-6) in which Track 2 OPEX begins. Source default 2. */
  track2StartYear: number;
  overheadMode: OverheadMode;
  /** Share of CAPEX recognised in each year. Source convention: all in Year 1. */
  capexPhasing: number[];
}

export interface ItemOverride {
  qty?: number;
  unitRate?: number;
  years?: number[];
  monthlyY1?: number;
  escPattern?: number[];
  excluded?: boolean;
}

export interface Overrides {
  globals: Partial<Globals>;
  scheduleMul: Record<ScheduleId, number>;
  gstBySchedule: Record<ScheduleId, number>;
  itemOverride: Record<string, ItemOverride>;
}

export interface Scenario {
  id: string;
  name: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  overrides: Overrides;
}

// ------------------------------------------------------------------ results

export interface YearRow {
  year: number;
  capex: number;
  opex: number;
  overhead: number;
  exGst: number;
  gst: number;
  inclGst: number;
}

export interface ScheduleResult {
  id: ScheduleId;
  name: string;
  kind: Kind;
  track: Track;
  years: number[];
  exGst: number;
  gst: number;
  inclGst: number;
  baselineExGst: number;
  itemCount: number;
}

export interface GroupResult {
  key: string;
  exGst: number;
  gst: number;
  inclGst: number;
  share: number;
}

export interface ItemResult {
  id: string;
  schedule: ScheduleId;
  kind: Kind;
  description: string;
  years: number[];
  exGst: number;
  gst: number;
  baselineExGst: number;
  modified: boolean;
  excluded: boolean;
}

export interface Totals {
  capex: number;
  opex: number;
  overhead: number;
  exGst: number;
  gst: number;
  inclGst: number;
  /** TCV (incl GST) minus this model's incl-GST budget. */
  tcvGap: number;
}

export interface ScenarioResult {
  globals: Globals;
  byYear: YearRow[];
  bySchedule: ScheduleResult[];
  byItem: ItemResult[];
  byTrack: GroupResult[];
  byOem: GroupResult[];
  byCategory: GroupResult[];
  byPhase: GroupResult[];
  totals: Totals;
  /** Monthly split, annual / 12, matching the source's even-distribution convention. */
  monthly: number[][];
}
