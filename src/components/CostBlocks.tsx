/**
 * The headline breakdown: total, then CAPEX / OPEX / Overhead as three clearly
 * separated blocks in large type.
 *
 * This is the first thing on the page because it is the question people actually
 * arrive with — how much, and split how. Small uniform KPI tiles made the three
 * cost blocks read as one undifferentiated row of numbers.
 */

import { crore, pct, rupees, signedPct } from '../model/format';
import type { ScenarioResult } from '../model/types';

const BLOCKS = [
  {
    key: 'capex' as const,
    label: 'CAPEX',
    cadence: 'One-time capital cost',
    color: '#1f7a7b',
    meta: '7 schedules (A–G) · 161 line items',
  },
  {
    key: 'opex' as const,
    label: 'OPEX',
    cadence: 'Recurring, Years 1–6',
    color: '#43b0b0',
    meta: '12 schedules (H1–O2) · 217 line items',
  },
  {
    key: 'overhead' as const,
    label: 'OVERHEAD',
    cadence: 'Recurring, Years 1–6',
    color: '#8b5cf6',
    meta: 'Schedule P · 16 line items',
  },
];

/** Split "₹329.46 Cr" so the figure can be set much larger than its unit. */
function Amount({ value, size = 46 }: { value: number; size?: number }) {
  const text = crore(value);
  const [fig, unit] = [text.replace(/ Cr$/, ''), 'Cr'];
  return (
    <span className="tnum inline-flex items-baseline gap-1.5" title={rupees(value, true)}>
      <span style={{ fontSize: size, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1 }}>
        {fig}
      </span>
      <span className="faint" style={{ fontSize: size * 0.4, fontWeight: 600 }}>
        {unit}
      </span>
    </span>
  );
}

export default function CostBlocks({
  result,
  baseline,
  showDelta,
}: {
  result: ScenarioResult;
  baseline: ScenarioResult;
  showDelta: boolean;
}) {
  const t = result.totals;

  return (
    <div className="mb-5 flex flex-col gap-4">
      {/* ---------------------------------------------------------- total */}
      <div className="card flex flex-wrap items-end justify-between gap-x-10 gap-y-5 px-7 py-6">
        <div>
          <p className="faint text-[11px] font-bold uppercase tracking-[0.14em]">
            Total project cost · 6 years · excl. GST
          </p>
          <div className="mt-1.5">
            <Amount value={t.exGst} size={54} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-9 gap-y-4">
          <div>
            <p className="faint text-[11px] font-bold uppercase tracking-[0.14em]">
              GST @ {pct(result.globals.gstRate, 0)}
            </p>
            <p className="tnum mt-1 text-[24px] font-bold" title={rupees(t.gst, true)}>
              {crore(t.gst)}
            </p>
          </div>
          <div className="faint pb-1.5 text-[22px] font-light">=</div>
          <div>
            <p className="faint text-[11px] font-bold uppercase tracking-[0.14em]">
              Total incl. GST
            </p>
            <p
              className="tnum mt-1 text-[28px] font-bold"
              style={{ color: 'var(--accent)' }}
              title={rupees(t.inclGst, true)}
            >
              {crore(t.inclGst)}
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ the three blocks */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {BLOCKS.map((b) => {
          const value = t[b.key];
          const share = t.exGst === 0 ? 0 : value / t.exGst;
          const base = baseline.totals[b.key];
          const delta = base === 0 ? 0 : (value - base) / base;
          const moved = Math.abs(value - base) > 1;

          return (
            <section
              key={b.key}
              className="card relative overflow-hidden px-6 py-5"
              style={{ borderTop: `3px solid ${b.color}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className="text-[13px] font-extrabold uppercase tracking-[0.12em]"
                    style={{ color: b.color }}
                  >
                    {b.label}
                  </p>
                  <p className="faint mt-0.5 text-[12px]">{b.cadence}</p>
                </div>
                <span
                  className="tnum rounded-md px-2 py-1 text-[13px] font-bold"
                  style={{ background: `${b.color}1a`, color: b.color }}
                >
                  {pct(share, 1)}
                </span>
              </div>

              <div className="mt-4">
                <Amount value={value} />
              </div>

              {/* share of the six-year total */}
              <div
                className="mt-4 h-1.5 overflow-hidden rounded-full"
                style={{ background: 'var(--border)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, share * 100)}%`, background: b.color }}
                />
              </div>

              <p className="faint mt-3 text-[11.5px] leading-snug">{b.meta}</p>

              {showDelta && (
                <p className="mt-2 text-[12px] font-semibold">
                  {moved ? (
                    <span
                      style={{
                        color: delta > 0 ? 'var(--color-coral-500)' : 'var(--color-mint-600)',
                      }}
                    >
                      {signedPct(delta)} vs tender ({crore(value - base)})
                    </span>
                  ) : (
                    <span className="faint">Unchanged from tender</span>
                  )}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
