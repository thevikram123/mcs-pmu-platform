/**
 * Job Cost Report actuals.
 *
 * Mirrors the Committed / Actual / % Complete columns of MCS_Phase3_JCR_Tracker.xlsx,
 * including its Estimated-Cost-to-Complete formula. Entries live in this browser's
 * localStorage — static hosting means there is no shared database, so use the JSON
 * export on the Scenarios page to hand a filled-in JCR to someone else.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../model/format';

export interface JcrEntry {
  committed: number;
  actual: number;
  /** 0..1 */
  percentComplete: number;
  note: string;
}

export interface ChangeOrder {
  id: string;
  cr: string;
  dateRaised: string;
  description: string;
  costCode: string;
  budgetImpact: number;
  status: 'Draft' | 'Raised' | 'PIC Review' | 'HPC Approved' | 'Rejected';
  picDate: string;
  hpcDate: string;
  note: string;
}

export const EMPTY_ENTRY: JcrEntry = { committed: 0, actual: 0, percentComplete: 0, note: '' };

export interface JcrRow {
  code: string;
  description: string;
  track: string;
  originalBudget: number;
  approvedCos: number;
  revisedBudget: number;
  committed: number;
  pctCommitted: number;
  actual: number;
  percentComplete: number;
  estToComplete: number;
  estFinalCost: number;
  variance: number;
  variancePct: number;
}

/**
 * The tracker's own logic, kept verbatim so the platform and the workbook agree:
 *   ETC = IFERROR(IF(%Complete>0, MAX(Actual/%Complete − Actual, 0), Revised − Actual), …)
 *   EFC = Actual + ETC ;  Variance = Revised − EFC
 */
export function deriveRow(
  code: string,
  description: string,
  track: string,
  originalBudget: number,
  entry: JcrEntry,
  approvedCos: number,
): JcrRow {
  const revisedBudget = originalBudget + approvedCos;
  const { committed, actual, percentComplete: p } = entry;
  const estToComplete =
    p > 0 ? Math.max(actual / p - actual, 0) : Math.max(revisedBudget - actual, 0);
  const estFinalCost = actual + estToComplete;
  const variance = revisedBudget - estFinalCost;
  return {
    code,
    description,
    track,
    originalBudget,
    approvedCos,
    revisedBudget,
    committed,
    pctCommitted: revisedBudget ? committed / revisedBudget : 0,
    actual,
    percentComplete: p,
    estToComplete,
    estFinalCost,
    variance,
    variancePct: revisedBudget ? variance / revisedBudget : 0,
  };
}

interface JcrState {
  asOf: string;
  entries: Record<string, JcrEntry>;
  changeOrders: ChangeOrder[];

  setAsOf: (d: string) => void;
  setEntry: (code: string, patch: Partial<JcrEntry>) => void;
  clearEntry: (code: string) => void;
  clearAll: () => void;

  addChangeOrder: () => string;
  updateChangeOrder: (id: string, patch: Partial<ChangeOrder>) => void;
  removeChangeOrder: (id: string) => void;

  /** Approved change-order value against a cost code — only HPC-approved CRs count. */
  approvedCosFor: (code: string) => number;

  replaceAll: (data: Pick<JcrState, 'asOf' | 'entries' | 'changeOrders'>) => void;
}

export const useJcr = create<JcrState>()(
  persist(
    (set, get) => ({
      asOf: new Date().toISOString().slice(0, 10),
      entries: {},
      changeOrders: [],

      setAsOf: (asOf) => set({ asOf }),

      setEntry(code, patch) {
        set((st) => ({
          entries: { ...st.entries, [code]: { ...EMPTY_ENTRY, ...st.entries[code], ...patch } },
        }));
      },

      clearEntry(code) {
        set((st) => {
          const entries = { ...st.entries };
          delete entries[code];
          return { entries };
        });
      },

      clearAll: () => set({ entries: {}, changeOrders: [] }),

      addChangeOrder() {
        const co: ChangeOrder = {
          id: uid('co'),
          cr: `CR-${String(get().changeOrders.length + 1).padStart(3, '0')}`,
          dateRaised: new Date().toISOString().slice(0, 10),
          description: '',
          costCode: '',
          budgetImpact: 0,
          status: 'Draft',
          picDate: '',
          hpcDate: '',
          note: '',
        };
        set((st) => ({ changeOrders: [...st.changeOrders, co] }));
        return co.id;
      },

      updateChangeOrder(id, patch) {
        set((st) => ({
          changeOrders: st.changeOrders.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
      },

      removeChangeOrder(id) {
        set((st) => ({ changeOrders: st.changeOrders.filter((c) => c.id !== id) }));
      },

      approvedCosFor(code) {
        return get()
          .changeOrders.filter((c) => c.costCode === code && c.status === 'HPC Approved')
          .reduce((a, c) => a + c.budgetImpact, 0);
      },

      replaceAll: (data) => set({ ...data }),
    }),
    { name: 'mcs.jcr', version: 1 },
  ),
);
