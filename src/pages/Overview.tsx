import { useState } from 'react';
import { Banner, Card, Chip, KpiTile, Money, Toggle } from '../components/ui';
import { CostOverTime, Donut, RankBar, SERIES } from '../components/charts';
import { baseline, baselineResult, scheduleLabel, useResult } from '../model/useModel';
import { crore, pct, rupees } from '../model/format';
import { useScenarios, BASELINE_ID } from '../store/scenarios';

export default function Overview() {
  const r = useResult();
  const b = baselineResult;
  const isBaseline = useScenarios((s) => s.activeId) === BASELINE_ID;
  const [pivot, setPivot] = useState('oem');
  const [chart, setChart] = useState('bar');

  const pivotData = {
    oem: r.byOem,
    category: r.byCategory,
    phase: r.byPhase,
    track: r.byTrack,
  }[pivot]!;

  const scheduleRows = [...r.bySchedule].sort((a, b2) => b2.exGst - a.exGst);
  const d = (v: number, base: number) => (base === 0 ? 0 : (v - base) / base);

  return (
    <>
      <Banner
        title="Dashboard — Overview"
        subtitle="Where the six-year budget sits, and how this scenario differs from the tender"
        right={<Chip>excl. GST unless stated</Chip>}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Cost over time"
          subtitle="Stacked by cost block across the six-year horizon"
          right={
            <Toggle
              value={chart}
              onChange={setChart}
              options={[
                { value: 'bar', label: 'Bars' },
                { value: 'area', label: 'Area' },
              ]}
            />
          }
        >
          <CostOverTime data={r.byYear} height={300} type={chart as 'bar' | 'area'} />
        </Card>

        <div className="flex flex-col gap-4">
          <KpiTile
            label="Total project cost"
            value={crore(r.totals.exGst)}
            sub="excl. GST"
            delta={isBaseline ? undefined : d(r.totals.exGst, b.totals.exGst)}
            icon={<span className="text-lg">Σ</span>}
            tone="teal"
            title={rupees(r.totals.exGst, true)}
          />
          <KpiTile
            label={`GST at ${pct(r.globals.gstRate, 0)}`}
            value={crore(r.totals.gst)}
            sub={`Incl. GST ${crore(r.totals.inclGst)}`}
            delta={isBaseline ? undefined : d(r.totals.gst, b.totals.gst)}
            icon={<span className="text-lg">₹</span>}
            tone="amber"
          />
          <KpiTile
            label="Peak annual spend"
            value={crore(Math.max(...r.byYear.map((y) => y.exGst)))}
            sub={`Year ${r.byYear.reduce((m, y) => (y.exGst > m.exGst ? y : m)).year}`}
            icon={<span className="text-lg">▲</span>}
            tone="coral"
          />
          <KpiTile
            label="Average annual OPEX"
            value={crore(r.totals.opex / 6)}
            sub="run-rate across six years"
            icon={<span className="text-lg">↻</span>}
            tone="mint"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Track split" subtitle="Track 1 legacy · Track 2 new build · shared services">
          <Donut
            data={r.byTrack}
            colors={[SERIES.capex, SERIES.opex, SERIES.overhead]}
            height={252}
          />
        </Card>

        <Card
          className="lg:col-span-2"
          title="Concentration"
          subtitle="Where the money is committed"
          right={
            <Toggle
              value={pivot}
              onChange={setPivot}
              options={[
                { value: 'oem', label: 'OEM' },
                { value: 'category', label: 'Category' },
                { value: 'phase', label: 'Phase' },
                { value: 'track', label: 'Track' },
              ]}
            />
          }
        >
          <RankBar data={pivotData.slice(0, 10)} height={252} />
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Schedule breakdown"
          subtitle="Every schedule, against its as-tendered value"
          bodyClass="p-0"
        >
          <div className="scroll-x max-h-[420px] overflow-y-auto">
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
                      <td className="max-w-[280px]">
                        <span className="font-semibold">{s.id}</span>{' '}
                        <span className="muted">{s.name}</span>
                      </td>
                      <td>
                        <Chip
                          tone={
                            s.kind === 'capex' ? 'teal' : s.kind === 'opex' ? 'mint' : 'violet'
                          }
                        >
                          {s.kind.toUpperCase()}
                        </Chip>
                      </td>
                      <td className="r">
                        <Money value={s.exGst} />
                      </td>
                      <td className="r muted">
                        <Money value={s.gst} />
                      </td>
                      <td className="r">
                        <Money value={s.inclGst} />
                      </td>
                      <td className="r muted">{pct(s.exGst / r.totals.exGst)}</td>
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
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                  <td colSpan={2}>TOTAL</td>
                  <td className="r">
                    <Money value={r.totals.exGst} />
                  </td>
                  <td className="r">
                    <Money value={r.totals.gst} />
                  </td>
                  <td className="r">
                    <Money value={r.totals.inclGst} />
                  </td>
                  <td className="r">100.0%</td>
                  <td className="r">
                    {Math.abs(r.totals.exGst - b.totals.exGst) < 1
                      ? '—'
                      : crore(r.totals.exGst - b.totals.exGst)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Contract reconciliation" subtitle="This model against the tendered TCV">
            <dl className="flex flex-col gap-3 text-[13px]">
              {[
                ['Total Contract Value (incl. GST)', baseline.contract.tcvInclGst],
                ['This model (incl. GST)', r.totals.inclGst],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between gap-3">
                  <dt className="muted">{k as string}</dt>
                  <dd className="font-semibold">
                    <Money value={v as number} />
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <dt className="font-semibold">Unreconciled gap</dt>
                <dd className="text-[15px] font-bold" style={{ color: 'var(--color-amber-450)' }}>
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
                The priced BOQ covers{' '}
                {pct(r.totals.inclGst / baseline.contract.tcvInclGst, 1)} of the tendered contract
                value. This gap is inherited from the source JCR, which flags it as an open item —
                it is not introduced by this platform.
              </p>
            </dl>
          </Card>

          <Card
            title="Source data quality"
            subtitle="Found while auditing the workbooks — carried through, not silently corrected"
          >
            <ul className="flex flex-col gap-4">
              {baseline.dataQuality.map((n) => (
                <li key={n.id}>
                  <div className="flex items-start gap-2">
                    <Chip tone={n.severity === 'defect' ? 'coral' : 'amber'}>
                      {n.severity}
                    </Chip>
                    <p className="flex-1 text-[12.5px] font-medium leading-snug">{n.summary}</p>
                  </div>
                  <p className="faint mt-1 font-mono text-[10.5px] leading-snug">{n.where}</p>
                  <p className="muted mt-1.5 text-[12px] leading-relaxed">{n.detail}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <p className="faint mt-5 text-[11.5px] leading-relaxed">
        Figures trace to {baseline.meta.sources.join(', ')}. Schedule labels:{' '}
        {scheduleLabel('A')} … {scheduleLabel('P')}.
      </p>
    </>
  );
}
