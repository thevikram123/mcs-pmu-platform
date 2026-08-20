import { useMemo } from 'react';
import baselineJson from '../data/baseline.json';
import type { Baseline, ScenarioResult, Overrides } from './types';
import { computeScenario, emptyOverrides } from './engine';
import { useScenarios } from '../store/scenarios';

export const baseline = baselineJson as unknown as Baseline;

/** Result for an arbitrary override set. */
export function useResultFor(overrides: Overrides): ScenarioResult {
  return useMemo(() => computeScenario(baseline, overrides), [overrides]);
}

/** Result for the currently selected scenario. */
export function useResult(): ScenarioResult {
  const overrides = useScenarios((s) => s.active().overrides);
  return useResultFor(overrides);
}

/** The as-tendered result. Computed once — it can never change. */
export const baselineResult: ScenarioResult = computeScenario(baseline, emptyOverrides());

export const scheduleById = new Map(baseline.schedules.map((s) => [s.id, s]));

export function scheduleLabel(id: string): string {
  const s = scheduleById.get(id);
  if (!s) return id;
  return s.kind === 'capex' ? s.name : `Schedule ${id}: ${s.name}`;
}
