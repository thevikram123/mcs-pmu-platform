/**
 * Milestone overrides.
 *
 * Dates derived from the MSA anchors are the contractual position. Anything the
 * user types here is a deviation from that, so every override is kept separate
 * from the derived value and surfaced as "modified" in the UI — the contractual
 * date is never overwritten, only shadowed.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MilestoneState {
  asOf: string;
  /** The New CCC handover date. Condition-based in every source document, so it
   *  is a project assumption here; M28/M29 derive from it by the MSA formula. */
  t4: string | null;
  /** milestone id -> ISO date the user set by hand */
  dates: Record<string, string>;
  /** milestone id -> marked as paid */
  paid: Record<string, boolean>;
  /** PO item key -> status the user set */
  poStatus: Record<string, string>;
  /** PO item key -> ISO date the user set */
  poDates: Record<string, string>;
  notes: Record<string, string>;

  setAsOf: (d: string) => void;
  setT4: (iso: string | null) => void;
  setDate: (id: string, iso: string | null) => void;
  togglePaid: (id: string) => void;
  setPoStatus: (key: string, status: string | null) => void;
  setPoDate: (key: string, iso: string | null) => void;
  setNote: (id: string, note: string) => void;
  resetDates: () => void;
  resetAll: () => void;
  replaceAll: (d: Partial<MilestoneState>) => void;
}

const drop = <T,>(rec: Record<string, T>, key: string) => {
  const next = { ...rec };
  delete next[key];
  return next;
};

export const useMilestones = create<MilestoneState>()(
  persist(
    (set) => ({
      asOf: new Date().toISOString().slice(0, 10),
      t4: null,
      dates: {},
      paid: {},
      poStatus: {},
      poDates: {},
      notes: {},

      setAsOf: (asOf) => set({ asOf }),

      setT4: (t4) => set({ t4 }),

      setDate: (id, iso) =>
        set((s) => ({ dates: iso ? { ...s.dates, [id]: iso } : drop(s.dates, id) })),

      togglePaid: (id) =>
        set((s) => (s.paid[id] ? { paid: drop(s.paid, id) } : { paid: { ...s.paid, [id]: true } })),

      setPoStatus: (key, status) =>
        set((s) => ({
          poStatus:
            status && status !== 'Pending'
              ? { ...s.poStatus, [key]: status }
              : drop(s.poStatus, key),
        })),

      setPoDate: (key, iso) =>
        set((s) => ({ poDates: iso ? { ...s.poDates, [key]: iso } : drop(s.poDates, key) })),

      setNote: (id, note) =>
        set((s) => ({ notes: note ? { ...s.notes, [id]: note } : drop(s.notes, id) })),

      resetDates: () => set({ dates: {} }),
      resetAll: () => set({ t4: null, dates: {}, paid: {}, poStatus: {}, poDates: {}, notes: {} }),
      replaceAll: (d) => set((s) => ({ ...s, ...d })),
    }),
    { name: 'mcs.milestones', version: 1 },
  ),
);
