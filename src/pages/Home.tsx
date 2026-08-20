import { Link } from 'react-router-dom';
import { Banner, Card, Chip } from '../components/ui';
import CostBlocks from '../components/CostBlocks';
import { CostOverTime } from '../components/charts';
import { baseline, baselineResult, useResult } from '../model/useModel';
import { crore } from '../model/format';
import { useScenarios, BASELINE_ID } from '../store/scenarios';

/* A first-time visitor gets an explicit route through the tool rather than six
   equally-weighted nav items and no indication of which to open first. */
const STEPS = [
  {
    n: 1,
    to: '/overview',
    title: 'See the breakdown',
    body: 'Every schedule and where the money concentrates — by OEM, category, phase and track.',
    cta: 'Open Cost Breakdown',
  },
  {
    n: 2,
    to: '/simulator',
    title: 'Try a what-if',
    body: 'Move GST, inflation, contingency or Track 2 timing. Figures update as you drag.',
    cta: 'Open Simulator',
  },
  {
    n: 3,
    to: '/scenarios',
    title: 'Export it',
    body: 'Download the scenario as an Excel workbook or a PDF report for review.',
    cta: 'Open Export',
  },
];

export default function Home() {
  const r = useResult();
  const activeId = useScenarios((s) => s.activeId);
  const active = useScenarios((s) => s.active());
  const isBaseline = activeId === BASELINE_ID;

  return (
    <>
      <Banner
        title="MCS Phase III — Expense Platform"
        subtitle={`Six-year cost model · ${active.name}`}
        right={
          <Link to="/simulator" className="btn !border-white/25 !bg-white/12 !text-white">
            Open simulator
          </Link>
        }
      />

      <p className="muted mb-5 max-w-3xl text-[13.5px] leading-relaxed">
        The full CAPEX, OPEX and overhead cost of Mumbai City Surveillance Phase III over six
        years, built from the tendered BOQ. Every figure below starts at its tendered value and
        can be changed — by slider or by typing — to test a scenario.
      </p>

      <CostBlocks result={r} baseline={baselineResult} showDelta={!isBaseline} />

      {/* --------------------------------------------------------- start here */}
      <div className="mb-5">
        <p className="faint mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em]">
          Start here
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {STEPS.map((s) => (
            <Link
              key={s.n}
              to={s.to}
              className="card flex flex-col p-5 transition hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] font-bold text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  {s.n}
                </span>
                <p className="text-[14.5px] font-semibold">{s.title}</p>
              </div>
              <p className="muted mt-2.5 flex-1 text-[12.5px] leading-relaxed">{s.body}</p>
              <p className="mt-3 text-[12.5px] font-semibold" style={{ color: 'var(--accent)' }}>
                {s.cta} →
              </p>
            </Link>
          ))}
        </div>
      </div>

      <Card
        title="Cost by year"
        subtitle="CAPEX lands in Year 1 per the source cash-flow convention; OPEX and overhead recur"
        right={<Chip tone="teal">excl. GST</Chip>}
      >
        <CostOverTime data={r.byYear} height={320} type="bar" />
      </Card>

      <p className="faint mt-5 text-[11.5px] leading-relaxed">
        At default settings this model reproduces the source workbooks exactly: CAPEX{' '}
        {crore(baselineResult.totals.capex)}, OPEX {crore(baselineResult.totals.opex)}, overhead{' '}
        {crore(baselineResult.totals.overhead)}. Sources: {baseline.meta.sources.join(', ')}.
      </p>
    </>
  );
}
