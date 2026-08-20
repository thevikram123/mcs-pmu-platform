import { Link } from 'react-router-dom';
import { Banner, Card, Chip, KpiTile, Money } from '../components/ui';
import { CostOverTime } from '../components/charts';
import { baseline, baselineResult, useResult } from '../model/useModel';
import { crore, pct } from '../model/format';
import { useScenarios, BASELINE_ID } from '../store/scenarios';

const FACT_KEYS = [
  'Total Contract Value (TCV)',
  'Performance Bank Guarantee (PBG)',
  'Contract Signing Date (T)',
  'Track 1 Handover Target (T1)',
  'Track 2 Go-Live Target (T2)',
  'Budget Baseline Source',
];

export default function Home() {
  const r = useResult();
  const activeId = useScenarios((s) => s.activeId);
  const active = useScenarios((s) => s.active());
  const isBaseline = activeId === BASELINE_ID;
  const b = baselineResult;

  const d = (v: number, base: number) => (base === 0 ? 0 : (v - base) / base);

  return (
    <>
      <Banner
        title="MCS Phase III — Expense Platform"
        subtitle={`Six-year cost model · ${active.name}`}
        right={
          <div className="flex items-center gap-2">
            <Link to="/simulator" className="btn !border-white/25 !bg-white/12 !text-white">
              Open simulator
            </Link>
            <Link to="/scenarios" className="btn !border-white/25 !bg-white/12 !text-white">
              Export
            </Link>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile
          label="CAPEX (one-time)"
          value={crore(r.totals.capex)}
          sub={isBaseline ? '7 schedules · 161 items' : 'vs baseline'}
          delta={isBaseline ? undefined : d(r.totals.capex, b.totals.capex)}
          icon={<span className="text-lg">▦</span>}
          tone="teal"
        />
        <KpiTile
          label="OPEX (6 years)"
          value={crore(r.totals.opex)}
          sub={isBaseline ? '12 schedules · 217 items' : 'vs baseline'}
          delta={isBaseline ? undefined : d(r.totals.opex, b.totals.opex)}
          icon={<span className="text-lg">↻</span>}
          tone="mint"
        />
        <KpiTile
          label="Overhead"
          value={crore(r.totals.overhead)}
          sub={
            r.globals.overheadMode === 'lock50cr' ? 'locked at ₹50 Cr' : 'bottom-up · 16 lines'
          }
          delta={isBaseline ? undefined : d(r.totals.overhead, b.totals.overhead)}
          icon={<span className="text-lg">⌂</span>}
          tone="violet"
        />
        <KpiTile
          label="Total excl. GST"
          value={crore(r.totals.exGst)}
          sub={isBaseline ? 'as tendered' : 'vs baseline'}
          delta={isBaseline ? undefined : d(r.totals.exGst, b.totals.exGst)}
          icon={<span className="text-lg">Σ</span>}
          tone="slate"
        />
        <KpiTile
          label="Total incl. GST"
          value={crore(r.totals.inclGst)}
          sub={`GST at ${pct(r.globals.gstRate, 0)}`}
          delta={isBaseline ? undefined : d(r.totals.inclGst, b.totals.inclGst)}
          icon={<span className="text-lg">₹</span>}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Cost over the six-year horizon"
          subtitle="CAPEX recognised in Year 1 per the source cash-flow convention; OPEX and overhead recur"
          right={<Chip tone="teal">excl. GST</Chip>}
        >
          <CostOverTime data={r.byYear} height={318} type="bar" />
        </Card>

        <Card title="Key project facts" subtitle="From the Phase III JCR tracker">
          <dl className="flex flex-col gap-3.5">
            {FACT_KEYS.filter((k) => baseline.projectFacts[k]).map((k) => (
              <div key={k}>
                <dt className="faint text-[11px] font-semibold uppercase tracking-wider">{k}</dt>
                <dd className="mt-0.5 text-[13px] font-medium leading-snug">
                  {baseline.projectFacts[k]}
                </dd>
              </div>
            ))}
            <div className="mt-1 border-t pt-3.5">
              <dt className="faint text-[11px] font-semibold uppercase tracking-wider">
                Unreconciled gap (TCV − this model, incl. GST)
              </dt>
              <dd className="mt-0.5 text-[15px] font-bold">
                <Money value={r.totals.tcvGap} />
              </dd>
              <p className="faint mt-1 text-[11.5px] leading-snug">
                Carried forward from the source JCR — the tendered contract value exceeds the
                priced BOQ. Tracked on the Overview page.
              </p>
            </div>
          </dl>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[
          {
            to: '/explorer',
            title: 'Cost Explorer',
            body: 'Drill from schedule to line item across 394 priced lines. Edit any quantity, rate or annual value.',
          },
          {
            to: '/simulator',
            title: 'Scenario Simulator',
            body: 'Move GST, inflation, contingency and Track 2 timing. See the effect attributed lever by lever.',
          },
          {
            to: '/jcr',
            title: 'Job Cost Report',
            body: 'Record committed and actual cost against each code. Estimated final cost and variance follow automatically.',
          },
        ].map((c) => (
          <Link key={c.to} to={c.to} className="card p-5 transition hover:-translate-y-0.5">
            <p className="text-[14px] font-semibold">{c.title}</p>
            <p className="muted mt-1.5 text-[12.5px] leading-relaxed">{c.body}</p>
            <p className="mt-3 text-[12.5px] font-semibold" style={{ color: 'var(--accent)' }}>
              Open →
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
