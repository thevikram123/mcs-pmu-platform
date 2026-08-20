import { useMemo, useState } from 'react';
import { Banner, Card, Empty, Money, NumberCell, Toggle } from '../components/ui';
import { RankBar } from '../components/charts';
import { baseline, useResult } from '../model/useModel';
import { crore, num, pct } from '../model/format';
import { useScenarios } from '../store/scenarios';
import type { Kind } from '../model/types';

const YEAR_COLS = [0, 1, 2, 3, 4, 5];

export default function Explorer() {
  const r = useResult();
  const { setItemOverride, setScheduleMul } = useScenarios();
  const overrides = useScenarios((s) => s.active().overrides);

  const [kind, setKind] = useState<Kind>('capex');
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [pivot, setPivot] = useState('oem');
  const [onlyModified, setOnlyModified] = useState(false);

  const capexById = useMemo(
    () => new Map(baseline.capexItems.map((i) => [i.id, i])),
    [],
  );
  const opexById = useMemo(() => new Map(baseline.opexItems.map((i) => [i.id, i])), []);
  const ovhById = useMemo(() => new Map(baseline.overheadItems.map((i) => [i.id, i])), []);

  const schedules = r.bySchedule.filter((s) => s.kind === kind);
  const query = q.trim().toLowerCase();

  const itemsFor = (scheduleId: string) =>
    r.byItem.filter((i) => {
      if (i.schedule !== scheduleId) return false;
      if (onlyModified && !i.modified) return false;
      if (!query) return true;
      const src = capexById.get(i.id) ?? opexById.get(i.id);
      return (
        i.description.toLowerCase().includes(query) ||
        (src?.oem ?? '').toLowerCase().includes(query)
      );
    });

  // When searching, auto-expand any schedule that has a hit.
  const matchCount = (scheduleId: string) => itemsFor(scheduleId).length;

  const pivotData = { oem: r.byOem, category: r.byCategory, phase: r.byPhase }[pivot]!;
  const modifiedCount = r.byItem.filter((i) => i.modified).length;

  return (
    <>
      <Banner
        title="Cost Explorer"
        subtitle="Drill from schedule to line item. Every quantity, rate and annual value is editable."
        right={
          <Toggle
            value={kind}
            onChange={(v) => {
              setKind(v as Kind);
              setOpen(null);
            }}
            options={[
              { value: 'capex', label: 'CAPEX' },
              { value: 'opex', label: 'OPEX' },
              { value: 'overhead', label: 'Overhead' },
            ]}
          />
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="inp max-w-[320px] !py-2"
          placeholder="Search description or OEM…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="muted flex items-center gap-2 text-[12.5px]">
          <input
            type="checkbox"
            checked={onlyModified}
            onChange={(e) => setOnlyModified(e.target.checked)}
          />
          Modified only ({modifiedCount})
        </label>
        <div className="ml-auto flex items-center gap-2">
          <span className="faint text-[12px]">
            {schedules.length} schedules ·{' '}
            {schedules.reduce((a, s) => a + matchCount(s.id), 0)} lines shown
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="flex flex-col gap-3 xl:col-span-3">
          {schedules.map((s) => {
            const items = itemsFor(s.id);
            const isOpen = open === s.id || (query.length > 1 && items.length > 0);
            const mulVal = overrides.scheduleMul[s.id] ?? 1;
            const dev = s.exGst - s.baselineExGst;

            return (
              <Card key={s.id} bodyClass="p-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => setOpen(isOpen && open === s.id ? null : s.id)}
                  >
                    <span className="faint w-3 text-[10px]">{isOpen ? '▼' : '▶'}</span>
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-[12px] font-bold text-white"
                      style={{ background: 'var(--accent)' }}
                    >
                      {s.id}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold">{s.name}</span>
                      <span className="faint block text-[11.5px]">
                        {s.itemCount} line items · {s.track}
                        {items.length !== s.itemCount && ` · ${items.length} shown`}
                      </span>
                    </span>
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="faint text-[11px]">×</span>
                    <NumberCell
                      value={mulVal}
                      baseline={1}
                      width="w-[68px]"
                      onChange={(v) => setScheduleMul(s.id, v <= 0 ? 1 : v)}
                      format={(v) => v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}
                    />
                  </div>

                  <div className="min-w-[120px] text-right">
                    <p className="text-[14px] font-bold">
                      <Money value={s.exGst} />
                    </p>
                    <p
                      className="text-[11.5px] font-medium"
                      style={{
                        color:
                          Math.abs(dev) < 1
                            ? 'var(--text-faint)'
                            : dev > 0
                              ? 'var(--color-coral-500)'
                              : 'var(--color-mint-600)',
                      }}
                    >
                      {Math.abs(dev) < 1 ? 'as tendered' : `${crore(dev)} vs tender`}
                    </p>
                  </div>
                </div>

                {isOpen && (
                  <div className="scroll-x border-t">
                    {items.length === 0 ? (
                      <Empty>No line items match the current filter.</Empty>
                    ) : (
                      <table className="grid">
                        <thead>
                          {kind === 'capex' ? (
                            <tr>
                              <th style={{ minWidth: 260 }}>Description</th>
                              <th>OEM</th>
                              <th>Phase</th>
                              <th className="r">Qty</th>
                              <th className="r">Unit rate ₹</th>
                              <th className="r">Amount</th>
                              <th className="r">vs tender</th>
                              <th />
                            </tr>
                          ) : kind === 'opex' ? (
                            <tr>
                              <th style={{ minWidth: 240 }}>Description</th>
                              {YEAR_COLS.map((y) => (
                                <th key={y} className="r">
                                  Yr {y + 1} ₹
                                </th>
                              ))}
                              <th className="r">6-yr total</th>
                              <th />
                            </tr>
                          ) : (
                            <tr>
                              <th style={{ minWidth: 240 }}>Description</th>
                              <th className="r">Monthly Yr 1 ₹</th>
                              <th className="r">Escalation</th>
                              {YEAR_COLS.map((y) => (
                                <th key={y} className="r">
                                  Yr {y + 1}
                                </th>
                              ))}
                              <th className="r">Total</th>
                              <th />
                            </tr>
                          )}
                        </thead>
                        <tbody>
                          {items.map((it) => {
                            const dev2 = it.exGst - it.baselineExGst;
                            const devCell = (
                              <td
                                className="r text-[12px] font-semibold"
                                style={{
                                  color:
                                    Math.abs(dev2) < 1
                                      ? 'var(--text-faint)'
                                      : dev2 > 0
                                        ? 'var(--color-coral-500)'
                                        : 'var(--color-mint-600)',
                                }}
                              >
                                {Math.abs(dev2) < 1 ? '—' : crore(dev2)}
                              </td>
                            );
                            const resetCell = (
                              <td className="r">
                                {it.modified && (
                                  <button
                                    className="faint text-[14px] hover:!text-[color:var(--accent)]"
                                    title="Reset this line to its source value"
                                    onClick={() => setItemOverride(it.id, null)}
                                  >
                                    ⟲
                                  </button>
                                )}
                              </td>
                            );

                            if (kind === 'capex') {
                              const src = capexById.get(it.id)!;
                              const ov = overrides.itemOverride[it.id];
                              return (
                                <tr key={it.id} style={it.excluded ? { opacity: 0.4 } : undefined}>
                                  <td className="max-w-[340px]">
                                    <span className="block truncate" title={it.description}>
                                      {it.description}
                                    </span>
                                  </td>
                                  <td className="muted text-[12px]">{src.oem}</td>
                                  <td className="muted text-[12px]">{src.phase ?? '—'}</td>
                                  <td className="r">
                                    <NumberCell
                                      value={ov?.qty ?? src.qty}
                                      baseline={src.qty}
                                      width="w-[78px]"
                                      onChange={(v) => setItemOverride(it.id, { qty: v })}
                                      format={(v) => num(v, 0)}
                                    />
                                  </td>
                                  <td className="r">
                                    <NumberCell
                                      value={ov?.unitRate ?? src.unitRate}
                                      baseline={src.unitRate}
                                      width="w-[108px]"
                                      onChange={(v) => setItemOverride(it.id, { unitRate: v })}
                                      format={(v) => num(v, 0)}
                                    />
                                  </td>
                                  <td className="r font-medium">
                                    <Money value={it.exGst} />
                                  </td>
                                  {devCell}
                                  {resetCell}
                                </tr>
                              );
                            }

                            if (kind === 'opex') {
                              const src = opexById.get(it.id)!;
                              const ov = overrides.itemOverride[it.id];
                              const years = ov?.years ?? src.years;
                              return (
                                <tr key={it.id} style={it.excluded ? { opacity: 0.4 } : undefined}>
                                  <td className="max-w-[300px]">
                                    <span className="block truncate" title={it.description}>
                                      {it.description}
                                    </span>
                                    <span className="faint text-[11px]">{src.oem}</span>
                                  </td>
                                  {YEAR_COLS.map((y) => (
                                    <td key={y} className="r">
                                      {src.naYears.includes(y) ? (
                                        <span className="faint text-[12px]" title="Source reads NA">
                                          NA
                                        </span>
                                      ) : (
                                        <NumberCell
                                          value={years[y]}
                                          baseline={src.years[y]}
                                          width="w-[96px]"
                                          onChange={(v) => {
                                            const next = years.slice();
                                            next[y] = v;
                                            setItemOverride(it.id, { years: next });
                                          }}
                                          format={(v) => num(v, 0)}
                                        />
                                      )}
                                    </td>
                                  ))}
                                  <td className="r font-medium">
                                    <Money value={it.exGst} />
                                  </td>
                                  {resetCell}
                                </tr>
                              );
                            }

                            const src = ovhById.get(it.id)!;
                            const ov = overrides.itemOverride[it.id];
                            const esc = ov?.escPattern ?? src.escPattern;
                            const uniform = esc.every((e) => Math.abs(e - esc[0]) < 1e-9);
                            return (
                              <tr key={it.id}>
                                <td className="max-w-[280px]">
                                  <span className="block truncate" title={it.description}>
                                    {it.description}
                                  </span>
                                </td>
                                <td className="r">
                                  <NumberCell
                                    value={ov?.monthlyY1 ?? src.monthlyY1}
                                    baseline={src.monthlyY1}
                                    width="w-[104px]"
                                    onChange={(v) => setItemOverride(it.id, { monthlyY1: v })}
                                    format={(v) => num(v, 0)}
                                  />
                                </td>
                                <td className="r">
                                  <NumberCell
                                    value={esc[0] * 100}
                                    baseline={src.escPattern[0] * 100}
                                    width="w-[66px]"
                                    onChange={(v) =>
                                      setItemOverride(it.id, {
                                        escPattern: new Array(5).fill(v / 100),
                                      })
                                    }
                                    format={(v) => `${v.toFixed(1)}%`}
                                  />
                                  {!uniform && (
                                    <span
                                      className="faint ml-1 text-[10px]"
                                      title={`Source alternates: ${src.escPattern.map((e) => pct(e, 0)).join(', ')}`}
                                    >
                                      alt
                                    </span>
                                  )}
                                </td>
                                {YEAR_COLS.map((y) => (
                                  <td key={y} className="r muted text-[12px]">
                                    {crore(it.years[y])}
                                  </td>
                                ))}
                                <td className="r font-medium">
                                  <Money value={it.exGst} />
                                </td>
                                {resetCell}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          <Card
            title="Concentration"
            subtitle="Across all blocks, this scenario"
            right={
              <Toggle
                value={pivot}
                onChange={setPivot}
                options={[
                  { value: 'oem', label: 'OEM' },
                  { value: 'category', label: 'Cat' },
                  { value: 'phase', label: 'Phase' },
                ]}
              />
            }
          >
            <RankBar data={pivotData.slice(0, 12)} height={330} />
          </Card>

          {kind === 'overhead' && (
            <Card title="How overhead is built" subtitle="Schedule P">
              <p className="muted text-[12.5px] leading-relaxed">
                Each line starts from a Year 1 monthly figure, annualised at ×12, then escalated
                year on year at its own rate — 10% on the three rents, 5% on salaries and
                vehicles, 2% on alternating years for electricity, and 0% on the five flat lines.
                That is the only block in the model that is genuinely driver-based in its source.
              </p>
              <p className="muted mt-3 text-[12.5px] leading-relaxed">
                In <strong>₹50 Cr lock</strong> mode the whole block is rescaled to land on exactly
                ₹50.00 Cr, matching Schedule P of the Phase III JCR tracker. Editing a line then
                changes the mix rather than the total.
              </p>
            </Card>
          )}

          <Card title="Reading this page" subtitle="">
            <ul className="muted flex list-disc flex-col gap-2 pl-4 text-[12.5px] leading-relaxed">
              <li>
                Editable cells turn teal once they differ from the tendered value; hover any of
                them to see the source figure.
              </li>
              <li>
                The <strong>×</strong> box beside each schedule scales every line in it at once.
              </li>
              <li>
                ⟲ resets a single line; the Simulator has a reset for the whole scenario.
              </li>
              <li>
                Editing while the Baseline scenario is selected forks a new scenario automatically
                — the tendered baseline can never be overwritten.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
