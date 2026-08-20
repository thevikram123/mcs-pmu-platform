/**
 * Scenario store. The active scenario's overrides drive every figure on screen.
 * Persisted to localStorage so work survives a reload; also exportable as JSON
 * so a scenario can be handed to a colleague (static hosting means there is no
 * shared server to sync through).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Globals, ItemOverride, Overrides, Scenario, ScheduleId } from '../model/types';
import { cloneOverrides, emptyOverrides } from '../model/engine';
import { uid } from '../model/format';

function makeScenario(name: string, overrides = emptyOverrides(), note = ''): Scenario {
  const now = new Date().toISOString();
  return { id: uid('scn'), name, note, createdAt: now, updatedAt: now, overrides };
}

/** The as-tendered baseline: no deviations at all. Always present, never edited. */
export const BASELINE_ID = 'scn-baseline';

const baselineScenario: Scenario = {
  ...makeScenario('Baseline (as tendered)', emptyOverrides(), 'Source BOQ figures, unmodified.'),
  id: BASELINE_ID,
};

interface ScenarioState {
  scenarios: Scenario[];
  activeId: string;
  compareId: string | null;

  active: () => Scenario;
  byId: (id: string) => Scenario | undefined;

  setActive: (id: string) => void;
  setCompare: (id: string | null) => void;

  create: (name: string, from?: string) => string;
  rename: (id: string, name: string, note?: string) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => string;
  importScenario: (s: Scenario) => string;

  setGlobal: <K extends keyof Globals>(key: K, value: Globals[K]) => void;
  resetGlobal: (key: keyof Globals) => void;
  setScheduleMul: (id: ScheduleId, value: number) => void;
  setScheduleGst: (id: ScheduleId, value: number | null) => void;
  setItemOverride: (itemId: string, patch: ItemOverride | null) => void;
  resetAll: () => void;
}

/** Mutate the active scenario's overrides; the baseline is copy-on-write. */
function editActive(
  state: ScenarioState,
  fn: (o: Overrides) => void,
): Partial<ScenarioState> {
  let { activeId, scenarios } = state;

  // The baseline must stay pristine, so the first edit forks it.
  if (activeId === BASELINE_ID) {
    const fork = makeScenario('Scenario 1', cloneOverrides(state.active().overrides));
    scenarios = [...scenarios, fork];
    activeId = fork.id;
  }

  scenarios = scenarios.map((s) => {
    if (s.id !== activeId) return s;
    const overrides = cloneOverrides(s.overrides);
    fn(overrides);
    return { ...s, overrides, updatedAt: new Date().toISOString() };
  });

  return { scenarios, activeId };
}

export const useScenarios = create<ScenarioState>()(
  persist(
    (set, get) => ({
      scenarios: [baselineScenario],
      activeId: BASELINE_ID,
      compareId: null,

      active: () => get().scenarios.find((s) => s.id === get().activeId) ?? baselineScenario,
      byId: (id) => get().scenarios.find((s) => s.id === id),

      setActive: (id) => set({ activeId: id }),
      setCompare: (id) => set({ compareId: id }),

      create(name, from) {
        const src = from ? get().byId(from) : undefined;
        const s = makeScenario(name, src ? cloneOverrides(src.overrides) : emptyOverrides());
        set((st) => ({ scenarios: [...st.scenarios, s], activeId: s.id }));
        return s.id;
      },

      rename(id, name, note) {
        set((st) => ({
          scenarios: st.scenarios.map((s) =>
            s.id === id
              ? { ...s, name, note: note ?? s.note, updatedAt: new Date().toISOString() }
              : s,
          ),
        }));
      },

      remove(id) {
        if (id === BASELINE_ID) return; // baseline is permanent
        set((st) => {
          const scenarios = st.scenarios.filter((s) => s.id !== id);
          return {
            scenarios,
            activeId: st.activeId === id ? BASELINE_ID : st.activeId,
            compareId: st.compareId === id ? null : st.compareId,
          };
        });
      },

      duplicate(id) {
        const src = get().byId(id);
        if (!src) return get().activeId;
        const copy = makeScenario(`${src.name} (copy)`, cloneOverrides(src.overrides), src.note);
        set((st) => ({ scenarios: [...st.scenarios, copy], activeId: copy.id }));
        return copy.id;
      },

      importScenario(s) {
        const fresh: Scenario = {
          ...s,
          id: uid('scn'),
          name: `${s.name} (imported)`,
          updatedAt: new Date().toISOString(),
        };
        set((st) => ({ scenarios: [...st.scenarios, fresh], activeId: fresh.id }));
        return fresh.id;
      },

      setGlobal(key, value) {
        set((st) => editActive(st, (o) => void (o.globals[key] = value)));
      },

      resetGlobal(key) {
        set((st) => editActive(st, (o) => void delete o.globals[key]));
      },

      setScheduleMul(id, value) {
        set((st) =>
          editActive(st, (o) => {
            if (value === 1) delete o.scheduleMul[id];
            else o.scheduleMul[id] = value;
          }),
        );
      },

      setScheduleGst(id, value) {
        set((st) =>
          editActive(st, (o) => {
            if (value == null) delete o.gstBySchedule[id];
            else o.gstBySchedule[id] = value;
          }),
        );
      },

      setItemOverride(itemId, patch) {
        set((st) =>
          editActive(st, (o) => {
            if (patch == null) {
              delete o.itemOverride[itemId];
              return;
            }
            const merged = { ...o.itemOverride[itemId], ...patch };
            for (const k of Object.keys(merged) as (keyof ItemOverride)[]) {
              if (merged[k] === undefined) delete merged[k];
            }
            if (Object.keys(merged).length === 0) delete o.itemOverride[itemId];
            else o.itemOverride[itemId] = merged;
          }),
        );
      },

      resetAll() {
        set((st) =>
          editActive(st, (o) => {
            o.globals = {};
            o.scheduleMul = {};
            o.gstBySchedule = {};
            o.itemOverride = {};
          }),
        );
      },
    }),
    {
      name: 'mcs.scenarios',
      version: 1,
      // The baseline is code, not user data — re-seed it on every load so an old
      // persisted copy can never drift from the workbooks.
      merge: (persisted, current) => {
        const p = persisted as Partial<ScenarioState> | undefined;
        const saved = (p?.scenarios ?? []).filter((s) => s.id !== BASELINE_ID);
        return {
          ...current,
          ...p,
          scenarios: [baselineScenario, ...saved],
          activeId: p?.activeId ?? BASELINE_ID,
        };
      },
    },
  ),
);
