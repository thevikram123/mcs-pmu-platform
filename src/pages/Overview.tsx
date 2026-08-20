import { useState } from 'react';
import { Banner, Card, Chip, Money, Toggle } from '../components/ui';
import CostBlocks from '../components/CostBlocks';
import HowTo from '../components/HowTo';
import { CostOverTime, Donut, RankBar, SERIES } from '../components/charts';
import { baseline, baselineResult, useResult } from '../model/useModel';
import { crore, pct } from '../model/format';
import { useScenarios, BASELINE_ID } from '../store/scenarios';

/*
 * One answer per page. The three cost blocks are the answer; every other view of
 * the same money sits behind a single set of tabs, rather than eight cards
 * competing for attention down one long scroll.
 */
const TABS = [
  { value: 'year', label: 'By year' },
  { value: 'schedule', label: 'By schedule' },
  { value: 'supplier', label: 'By supplier' },
  { value: 'contract', label: 'Contract & notes' },
];

export default function Overview() {
  const r = useResult();
  const b = baselineResult;
  const isBaseline = useScenarios((s) => s.activeId) === BASELINE_ID;
  const [tab, setTab] = useState('year');
  const [pivot, setPivot] = useState('oem');
  const [chart, setChart] = useState('bar');

  const pivotData = { oem: r.byOem, category: r.byCategory, phase: r.byPhase }[pivot]!;
  const scheduleRows = [...r.bySchedule].sort((x, y) => y.exGst - x.exGst);

  const devColor = (d: number) =>
    Math.abs(d) < 1
      ? 'var(--text-faint)'
      : d > 0
        ? 'var(--color-coral-500)'
        : 'var(--color-mint-600)';

  return (
    <>
      <Banner
        title="Cost Breakdown"
        subtitle="The whole six-year budget, and where it sits"
        right={<Chip>excl. GST unless stated</Chip>}
      />

      <HowTo
        id="overview"
        purpose="A read-only picture of the six-year budget: the three cost blocks, then the same money viewed a different way on the tabs below."
        steps={[
          { do: 'Read the three blocks', then: 'CAPEX, OPEX and overhead with their share of the total' },
          { do: 'Pick a tab', then: 'to split the same money by year, schedule or supplier' },
          { do: 'Hover any figure', then: 'for the exact rupee amount behind the crore rounding' },
        ]}
        note="Nothing here is editable. To change figures, go to Line Items or the What-If Simulator."
      />

      <CostBlocks result={r} baseline={b} showDelta={!isBaseline} />

      <Card
        title={TABS.find((t) => t.value === tab)!.label}
        subtitle="The same six-year total, viewed a different way"
        right={<Toggle value={tab} onChange={setTab} options={TABS} />}
        bodyClass={tab === 'schedule' ? 'p-0' : 'p-5'}
      >
        {/* -------------------------------------------------------- by year */}
        {tab === 'year' && (
          <>
            <div className="mb-4 flex justify-end">
              <Toggle
                value={chart}
                onChange={setChart}
                options={[
                  { value: 'bar', label: 'Bars' },
                  { value: 'area', label: 'Area' },
                ]}
              />
            </div>
            <CostOverTime data={r.byYear} height={300} type={chart as 'bar' | 'area'} />
            <div className="scroll-x mt-5">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th className="r">CAPEX</th>
                    <th className="r">OPEX</th>
                    <th className="r">Overhead</th>
                    <th className="r">Total excl. GST</th>
                    <th className="r">GST</th>
                    <th className="r">Total incl. GST</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byYear.map((y) => (
                    <tr key={y.year}>
                      <td className="font-semibold">Year {y.year}</td>
                      <td className="r muted">{y.capex === 0 ? '—' : crore(y.capex)}</td>
                      <td className="r muted">{crore(y.opex)}</td>
                      <td className="r muted">{crore(y.overhead)}</td>
                      <td className="r font-medium">
                        <Money value={y.exGst} />
                      </td>
                      <td className="r muted">{crore(y.gst)}</td>
                      <td className="r">{crore(y.inclGst)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                    <td>TOTAL</td>
                    <td className="r">{crore(r.totals.capex)}</td>
                    <td className="r">{crore(r.totals.opex)}</td>
                    <td className="r">{crore(r.totals.overhead)}</td>
                    <td className="r">{crore(r.totals.exGst)}</td>
                    <td className="r">{crore(r.totals.gst)}</td>
                    <td className="r">{crore(r.totals.inclGst)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* ---------------------------------------------------- by schedule */}
        {tab === 'schedule' && (
          <div className="scroll-x">
            <table className="grid">
              <thead>
                <tr>
                  <th>Schedule</th>
                  <th>Block</th>
                  <th className="r">Excl. GST</th>
                  <th className="r">GST</th>
                  <th className="r">Incl. GST</th>
                  <th className="r">Share</th>
                  <th className="r">vs tender</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((s) => {
                  const dev = s.exGst - s.baselineExGst;
                  return (
                    <tr key={s.id}>
                      <td className="max-w-[300px]">
                        <span className="font-semibold">{s.id}</span>{' '}
                        <span className="muted">{s.name}</span>
                      </td>
                      <td>
                        <Chip
                          tone={s.kind === 'capex' ? 'teal' : s.kind === 'opex' ? 'mint' : 'violet'}
                        >
                          {s.kind.toUpperCase()}
                        </Chip>
                      </td>
                      <td className="r">
                        <Money value={s.exGst} />
                      </td>
                      <td className="r muted">{crore(s.gst)}</td>
                      <td className="r">{crore(s.inclGst)}</td>
                      <td className="r muted">{pct(s.exGst / r.totals.exGst)}</td>
                      <td className="r font-semibold" style={{ color: devColor(dev) }}>
                        {Math.abs(dev) < 1 ? '—' : crore(dev)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                  <td colSpan={2}>TOTAL</td>
                  <td className="r">{crore(r.totals.exGst)}</td>
                  <td className="r">{crore(r.totals.gst)}</td>
                  <td className="r">{crore(r.totals.inclGst)}</td>
                  <td className="r">100.0%</td>
                  <td className="r" style={{ color: devColor(r.totals.exGst - b.totals.exGst) }}>
                    {Math.abs(r.totals.exGst - b.totals.exGst) < 1
                      ? '—'
                      : crore(r.totals.exGst - b.totals.exGst)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ---------------------------------------------------- by supplier */}
        {tab === 'supplier' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="muted text-[12.5px]">Top 12 by six-year value</p>
                <Toggle
                  value={pivot}
                  onChange={setPivot}
                  options={[
                    { value: 'oem', label: 'OEM' },
                    { value: 'category', label: 'Category' },
                    { value: 'phase', label: 'Phase' },
                  ]}
                />
              </div>
              <RankBar data={pivotData.slice(0, 12)} height={340} />
            </div>
            <div>
              <p className="muted mb-2 text-[12.5px]">Track split</p>
              <Donut
                data={r.byTrack}
                colors={[SERIES.capex, SERIES.opex, SERIES.overhead]}
                height={300}
              />
            </div>
          </div>
        )}

        {/* ----------------------------------------------------- contract */}
        {tab === 'contract' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <h3 className="text-[13.5px] font-semibold">Contract reconciliation</h3>
              <dl className="mt-3 flex flex-col gap-3 text-[13px]">
                {(
                  [
                    ['Total Contract Value (incl. GST)', baseline.contract.tcvInclGst],
                    ['This model (incl. GST)', r.totals.inclGst],
                  ] as [string, number][]
                ).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <dt className="muted">{k}</dt>
                    <dd className="font-semibold">
                      <Money value={v} />
                    </dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border-t pt-3">
                  <dt className="font-semibold">Unreconciled gap</dt>
                  <dd className="text-[16px] font-bold" style={{ color: 'var(--color-amber-450)' }}>
                    <Money value={r.totals.tcvGap} />
                  </dd>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full"
                  style={{ background: 'var(--border)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (r.totals.inclGst / baseline.contract.tcvInclGst) * 100)}%`,
                      background: 'var(--accent)',
                    }}
                  />
                </div>
                <p className="faint text-[11.5px] leading-relaxed">
                  The priced BOQ covers {pct(r.totals.inclGst / baseline.contract.tcvInclGst, 1)} of
                  the tendered contract value. This gap is inherited from the source JCR, which
                  flags it as an open item — it is not introduced by this platform.
                </p>
              </dl>
            </div>

            <div>
              <h3 className="text-[13.5px] font-semibold">Source data quality</h3>
              <p className="faint mt-1 text-[12px]">
                Found while auditing the workbooks. Carried through as-is, not silently corrected.
              </p>
              <ul className="mt-3 flex flex-col gap-4">
                {baseline.dataQuality.map((n) => (
                  <li key={n.id}>
                    <div className="flex items-start gap-2">
                      <Chip tone={n.severity === 'defect' ? 'coral' : 'amber'}>{n.severity}</Chip>
                      <p className="flex-1 text-[12.5px] font-medium leading-snug">{n.summary}</p>
                    </div>
                    <p className="faint mt-1 font-mono text-[10.5px] leading-snug">{n.where}</p>
                    <p className="muted mt-1.5 text-[12px] leading-relaxed">{n.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      <p className="faint mt-5 text-[11.5px] leading-relaxed">
        Figures trace to {baseline.meta.sources.join(', ')}.
      </p>
    </>
  );
}
