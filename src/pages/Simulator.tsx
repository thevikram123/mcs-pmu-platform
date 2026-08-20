import { useMemo, useState } from 'react';
import { Banner, Card, Chip, Money, SliderInput, Toggle } from '../components/ui';
import CostBlocks from '../components/CostBlocks';
import HowTo from '../components/HowTo';
import { CompareChart, Waterfall, RankBar } from '../components/charts';
import { baseline, baselineResult, useResult } from '../model/useModel';
import { computeScenario, DEFAULT_GLOBALS, emptyOverrides } from '../model/engine';
import { crore, deltaCr, pct, signedPct } from '../model/format';
import { useScenarios } from '../store/scenarios';
import type { Globals, Overrides } from '../model/types';

const RESULT_TABS = [
  { value: 'forecast', label: 'Forecast', hint: 'Year-by-year total against the tender' },
  { value: 'why', label: 'Why it moved', hint: 'Each active lever’s contribution to the change' },
  { value: 'sensitivity', label: 'Sensitivity', hint: 'Impact of each lever applied alone to the tender' },
  { value: 'table', label: 'Numbers', hint: 'The full year-by-year table for this scenario' },
];

/** Impact readout shown directly under each slider. */
function Impact({ delta }: { delta: number }) {
  if (Math.abs(delta) < 1) {
    return <span className="faint">No effect at this setting</span>;
  }
  return (
    <span
      className="font-semibold"
      style={{ color: delta > 0 ? 'var(--color-coral-500)' : 'var(--color-mint-600)' }}
    >
      {deltaCr(delta)} on the six-year total
    </span>
  );
}

/** Effect of a single lever, holding everything else at this scenario's setting. */
function leverDelta(overrides: Overrides, key: keyof Globals, total: number): number {
  const without: Overrides = {
    ...overrides,
    globals: { ...overrides.globals },
  };
  delete without.globals[key];
  return total - computeScenario(baseline, without).totals.exGst;
}

export default function Simulator() {
  const r = useResult();
  const b = baselineResult;
  const overrides = useScenarios((s) => s.active().overrides);
  const active = useScenarios((s) => s.active());
  const { setGlobal, resetGlobal, setScheduleMul, resetAll } = useScenarios();
  const [tab, setTab] = useState('global');
  const [view, setView] = useState('forecast');

  const g = r.globals;
  const set = <K extends keyof Globals>(k: K) => (v: Globals[K]) => setGlobal(k, v);

  const waterfall = useMemo(() => {
    const rows: { name: string; delta: number }[] = [];
    const t = r.totals.exGst;
    const levers: [keyof Globals, string][] = [
      ['inflationDelta', 'Inflation'],
      ['capexContingency', 'CAPEX cont.'],
      ['opexContingency', 'OPEX cont.'],
      ['track2StartYear', 'Track 2 start'],
      ['overheadMode', 'Overhead mode'],
      ['capexPhasing', 'CAPEX phasing'],
    ];
    for (const [k, label] of levers) {
      if (!(k in overrides.globals)) continue;
      const d = leverDelta(overrides, k, t);
      if (Math.abs(d) > 1) rows.push({ name: label, delta: d });
    }
    // Schedule multipliers and line edits, lumped.
    const noSched: Overrides = { ...overrides, scheduleMul: {} };
    const dS = t - computeScenario(baseline, noSched).totals.exGst;
    if (Math.abs(dS) > 1) rows.push({ name: 'Schedule ×', delta: dS });
    const noItems: Overrides = { ...overrides, itemOverride: {} };
    const dI = t - computeScenario(baseline, noItems).totals.exGst;
    if (Math.abs(dI) > 1) rows.push({ name: 'Line edits', delta: dI });
    return rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  }, [overrides, r.totals.exGst]);

  /** One-at-a-time sensitivity from the tendered baseline. */
  const tornado = useMemo(() => {
    const probe = (patch: Partial<Globals>) =>
      computeScenario(baseline, { ...emptyOverrides(), globals: patch }).totals.exGst -
      b.totals.exGst;
    return [
      { key: 'Inflation +2pt', exGst: Math.abs(probe({ inflationDelta: 0.02 })) },
      { key: 'CAPEX cont. +5%', exGst: Math.abs(probe({ capexContingency: 0.05 })) },
      { key: 'OPEX cont. +5%', exGst: Math.abs(probe({ opexContingency: 0.05 })) },
      { key: 'Track 2 slips 1 yr', exGst: Math.abs(probe({ track2StartYear: 3 })) },
      { key: 'Overhead → ₹50 Cr', exGst: Math.abs(probe({ overheadMode: 'lock50cr' })) },
    ].sort((x, y) => y.exGst - x.exGst);
  }, [b.totals.exGst]);

  /** What each individual lever is currently contributing. */
  const impact = useMemo(() => {
    const t = r.totals.exGst;
    const keys: (keyof Globals)[] = [
      'gstRate',
      'inflationDelta',
      'capexContingency',
      'opexContingency',
      'track2StartYear',
      'overheadMode',
      'capexPhasing',
    ];
    const out = {} as Record<keyof Globals, number>;
    for (const k of keys) out[k] = k in overrides.globals ? leverDelta(overrides, k, t) : 0;
    return out;
  }, [overrides, r.totals.exGst]);

  const compareData = r.byYear.map((y, i) => ({
    year: y.year,
    baseline: b.byYear[i].exGst,
    scenario: y.exGst,
  }));

  const dTotal = r.totals.exGst - b.totals.exGst;
  const dIncl = r.totals.inclGst - b.totals.inclGst;

  const changedSchedules = Object.entries(overrides.scheduleMul).filter(([, v]) => v !== 1);

  return (
    <>
      <Banner
        title="Scenario Simulator"
        subtitle={`What-if analysis · ${active.name}`}
        right={
          <button className="btn !border-white/25 !bg-white/12 !text-white" onClick={resetAll}>
            Reset all to tender
          </button>
        }
      />

      <HowTo
        id="simulator"
        purpose="Test what happens to the six-year cost if an assumption changes — tax, inflation, contingency, or when Track 2 goes live."
        steps={[
          { do: 'Drag a slider', then: 'every figure on the page updates as you drag' },
          { do: 'Or type an exact value', then: 'in the box beside the slider, then press Enter' },
          { do: 'Read the line under each slider', then: 'it states that lever’s own effect on the total' },
          { do: 'Watch the three blocks above', then: 'they show the new CAPEX / OPEX / overhead split' },
          { do: 'Check "What moved the number"', then: 'it attributes the change lever by lever' },
          { do: 'Click ⟲ or Reset all', then: 'to return to the tendered figures' },
        ]}
        note="Nothing here is saved over the tender: the Baseline scenario always holds the original BOQ figures, and your changes go into a separate working scenario."
      />

      <CostBlocks result={r} baseline={b} showDelta />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
        {/* ------------------------------------------------------- controls */}
        <div className="flex flex-col gap-4">
          <Card
            title="Cost levers"
            subtitle="Drag or type. Every control shows its tendered value on the reset button."
            right={
              <Toggle
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'global', label: 'Global' },
                  { value: 'schedule', label: 'Schedules' },
                ]}
              />
            }
          >
            {tab === 'global' ? (
              <div className="flex flex-col gap-5">
                <SliderInput
                  label="GST rate"
                  hint={<>Applied to every ex-GST figure. Source rate is 18%. GST is not part of the ex-GST total, so this moves the incl-GST figure only.</>}
                  value={g.gstRate * 100}
                  baseline={DEFAULT_GLOBALS.gstRate * 100}
                  min={0}
                  max={40}
                  step={0.5}
                  suffix="%"
                  format={(v) => v.toFixed(1)}
                  onChange={(v) => set('gstRate')(v / 100)}
                  onReset={() => resetGlobal('gstRate')}
                />
                <SliderInput
                  label="Additional inflation (per year)"
                  hint={<>Compounds on top of the escalation already priced into the BOQ. Year 1 is unaffected. <Impact delta={impact.inflationDelta} /></>}
                  value={g.inflationDelta * 100}
                  baseline={0}
                  min={-5}
                  max={15}
                  step={0.25}
                  suffix="%"
                  format={(v) => v.toFixed(2)}
                  onChange={(v) => set('inflationDelta')(v / 100)}
                  onReset={() => resetGlobal('inflationDelta')}
                />
                <SliderInput
                  label="CAPEX contingency"
                  hint={<Impact delta={impact.capexContingency} />}
                  value={g.capexContingency * 100}
                  baseline={0}
                  min={0}
                  max={25}
                  step={0.5}
                  suffix="%"
                  format={(v) => v.toFixed(1)}
                  onChange={(v) => set('capexContingency')(v / 100)}
                  onReset={() => resetGlobal('capexContingency')}
                />
                <SliderInput
                  label="OPEX contingency"
                  hint={<Impact delta={impact.opexContingency} />}
                  value={g.opexContingency * 100}
                  baseline={0}
                  min={0}
                  max={25}
                  step={0.5}
                  suffix="%"
                  format={(v) => v.toFixed(1)}
                  onChange={(v) => set('opexContingency')(v / 100)}
                  onReset={() => resetGlobal('opexContingency')}
                />
                <SliderInput
                  label="Track 2 start year"
                  hint={<>Schedules H2, I2, J2 and O2. Spend pushed past Year 6 falls outside the horizon, so slipping Track 2 lowers the six-year total. <Impact delta={impact.track2StartYear} /></>}
                  value={g.track2StartYear}
                  baseline={DEFAULT_GLOBALS.track2StartYear}
                  min={1}
                  max={6}
                  step={1}
                  format={(v) => `Yr ${v.toFixed(0)}`}
                  parse={(s) => Number(s.replace(/[^0-9.-]/g, ''))}
                  onChange={set('track2StartYear')}
                  onReset={() => resetGlobal('track2StartYear')}
                />

                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium">Overhead basis</p>
                  <Toggle
                    value={g.overheadMode}
                    onChange={(v) => set('overheadMode')(v as Globals['overheadMode'])}
                    options={[
                      { value: 'bottomUp', label: 'Bottom-up' },
                      { value: 'lock50cr', label: 'Lock ₹50 Cr' },
                    ]}
                  />
                  <p className="faint mt-1.5 text-[11.5px] leading-snug">
                    Bottom-up builds the 16 overhead lines from their monthly base and escalation
                    ({crore(b.totals.overhead)}). Lock rescales the block to the flat ₹50.00 Cr
                    carried as Schedule P in the Phase III JCR tracker.
                  </p>
                </div>

                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium">CAPEX recognition</p>
                  <Toggle
                    value={g.capexPhasing[0] === 1 ? 'y1' : 'spread'}
                    onChange={(v) =>
                      set('capexPhasing')(
                        v === 'y1' ? [1, 0, 0, 0, 0, 0] : [0.5, 0.5, 0, 0, 0, 0],
                      )
                    }
                    options={[
                      { value: 'y1', label: 'All Year 1' },
                      { value: 'spread', label: 'Split Yr 1–2' },
                    ]}
                  />
                  <p className="faint mt-1.5 text-[11.5px] leading-snug">
                    The source BOQ gives no year-wise CAPEX split; the Executive Summary places it
                    all in Year 1 for cash-flow presentation. Splitting changes the profile, never
                    the total.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="faint text-[11.5px] leading-snug">
                  A multiplier on every line in the schedule. 1.00 leaves it at the tendered value.
                </p>
                {r.bySchedule.map((s) => (
                  <SliderInput
                    key={s.id}
                    label={
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-semibold">{s.id}</span>
                        <span className="muted truncate text-[11.5px]">{s.name}</span>
                      </span>
                    }
                    hint={
                      <span>
                        {crore(s.baselineExGst)} → <strong>{crore(s.exGst)}</strong>
                      </span>
                    }
                    value={overrides.scheduleMul[s.id] ?? 1}
                    baseline={1}
                    min={0}
                    max={2}
                    step={0.01}
                    format={(v) => v.toFixed(2)}
                    onChange={(v) => setScheduleMul(s.id, v)}
                    onReset={() => setScheduleMul(s.id, 1)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* -------------------------------------------------------- results */}
        <div className="flex flex-col gap-4">
          {/*
            One result panel with tabs, not five stacked cards. The headline
            movement stays pinned in the header so it is visible whichever view
            is open.
          */}
          <Card
            title={RESULT_TABS.find((t) => t.value === view)!.label}
            subtitle={RESULT_TABS.find((t) => t.value === view)!.hint}
            right={
              <div className="flex items-center gap-3">
                <Chip tone={Math.abs(dTotal) < 1 ? undefined : dTotal > 0 ? 'coral' : 'mint'}>
                  {Math.abs(dTotal) < 1
                    ? 'at tender'
                    : `${deltaCr(dTotal)} · ${signedPct(dTotal / b.totals.exGst)}`}
                </Chip>
                <Toggle value={view} onChange={setView} options={RESULT_TABS} />
              </div>
            }
          >
            {view === 'forecast' && <CompareChart data={compareData} height={330} />}

            {view === 'why' &&
              (waterfall.length ? (
                <Waterfall data={waterfall} height={330} />
              ) : (
                <p className="faint py-24 text-center text-[13px]">
                  Nothing changed yet — every control is at its tendered value.
                  <br />
                  Move a slider on the left to see its effect attributed here.
                </p>
              ))}

            {view === 'sensitivity' && (
              <RankBar data={tornado} height={330} color={() => '#43b0b0'} />
            )}

            {view === 'table' && (
              <div className="scroll-x">
                <table className="grid">
                  <thead>
                    <tr>
                      <th>Cost block</th>
                      {r.byYear.map((y) => (
                        <th key={y.year} className="r">
                          Year {y.year}
                        </th>
                      ))}
                      <th className="r">6-year total</th>
                      <th className="r">vs tender</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(['capex', 'opex', 'overhead'] as const).map((k) => {
                      const dev = r.totals[k] - b.totals[k];
                      return (
                        <tr key={k}>
                          <td className="font-medium capitalize">{k}</td>
                          {r.byYear.map((y) => (
                            <td key={y.year} className="r muted">
                              {y[k] === 0 ? '—' : crore(y[k])}
                            </td>
                          ))}
                          <td className="r font-semibold">
                            <Money value={r.totals[k]} />
                          </td>
                          <td
                            className="r font-semibold"
                            style={{
                              color:
                                Math.abs(dev) < 1
                                  ? 'var(--text-faint)'
                                  : dev > 0
                                    ? 'var(--color-coral-500)'
                                    : 'var(--color-mint-600)',
                            }}
                          >
                            {Math.abs(dev) < 1 ? '—' : crore(dev)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                      <td>Total excl. GST</td>
                      {r.byYear.map((y) => (
                        <td key={y.year} className="r">
                          {crore(y.exGst)}
                        </td>
                      ))}
                      <td className="r">
                        <Money value={r.totals.exGst} />
                      </td>
                      <td className="r">{Math.abs(dTotal) < 1 ? '—' : crore(dTotal)}</td>
                    </tr>
                    <tr>
                      <td className="muted">GST at {pct(g.gstRate, 0)}</td>
                      {r.byYear.map((y) => (
                        <td key={y.year} className="r muted">
                          {crore(y.gst)}
                        </td>
                      ))}
                      <td className="r font-semibold">
                        <Money value={r.totals.gst} />
                      </td>
                      <td className="r muted">
                        {Math.abs(dIncl - dTotal) < 1 ? '—' : crore(r.totals.gst - b.totals.gst)}
                      </td>
                    </tr>
                    <tr style={{ fontWeight: 700 }}>
                      <td>Total incl. GST</td>
                      {r.byYear.map((y) => (
                        <td key={y.year} className="r">
                          {crore(y.inclGst)}
                        </td>
                      ))}
                      <td className="r">
                        <Money value={r.totals.inclGst} />
                      </td>
                      <td className="r">{Math.abs(dIncl) < 1 ? '—' : crore(dIncl)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {changedSchedules.length > 0 && (
            <Card title="Active schedule multipliers" subtitle="Click one to reset it">
              <div className="flex flex-wrap gap-2">
                {changedSchedules.map(([id, v]) => (
                  <button
                    key={id}
                    className="chip hover:!border-[color:var(--accent)]"
                    onClick={() => setScheduleMul(id, 1)}
                  >
                    {id} × {v.toFixed(2)} ⟲
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
