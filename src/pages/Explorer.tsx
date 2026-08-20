import { useEffect, useMemo, useState } from 'react';
import { Banner, Card, Chip, Empty, Money, NumberCell, Toggle } from '../components/ui';
import HowTo from '../components/HowTo';
import { baseline, useResult } from '../model/useModel';
import { crore, pct } from '../model/format';
import { useScenarios } from '../store/scenarios';
import type { Kind } from '../model/types';

const YEARS = [0, 1, 2, 3, 4, 5];

/*
 * Master-detail, not a stack of twenty accordions. Pick a schedule on the left,
 * edit its line items on the right — one thing open at a time, and the schedule
 * list stays visible so you always know where you are.
 */
export default function Explorer() {
  const r = useResult();
  const { setItemOverride, setScheduleMul } = useScenarios();
  const overrides = useScenarios((s) => s.active().overrides);

  const [kind, setKind] = useState<Kind>('capex');
  const [selected, setSelected] = useState<string>('A');
  const [q, setQ] = useState('');
  const [onlyModified, setOnlyModified] = useState(false);
  // The rail costs 300px that the wide OPEX/overhead tables need on a laptop.
  const [railOpen, setRailOpen] = useState(
    () => localStorage.getItem('mcs.explorerRail') !== 'closed',
  );
  useEffect(() => {
    localStorage.setItem('mcs.explorerRail', railOpen ? 'open' : 'closed');
  }, [railOpen]);

  const capexById = useMemo(() => new Map(baseline.capexItems.map((i) => [i.id, i])), []);
  const opexById = useMemo(() => new Map(baseline.opexItems.map((i) => [i.id, i])), []);
  const ovhById = useMemo(() => new Map(baseline.overheadItems.map((i) => [i.id, i])), []);

  const schedules = r.bySchedule.filter((s) => s.kind === kind);
  const firstId = schedules[0]?.id ?? '';
  const valid = schedules.some((s) => s.id === selected);

  // Keep the selection valid when the cost block changes.
  useEffect(() => {
    if (!valid) setSelected(firstId);
  }, [valid, firstId]);

  const query = q.trim().toLowerCase();
  const matches = (id: string) =>
    r.byItem.filter((i) => {
      if (i.schedule !== id) return false;
      if (onlyModified && !i.modified) return false;
      if (!query) return true;
      const src = capexById.get(i.id) ?? opexById.get(i.id);
      return (
        i.description.toLowerCase().includes(query) ||
        (src?.oem ?? '').toLowerCase().includes(query)
      );
    });

  const current = schedules.find((s) => s.id === selected);
  const items = current ? matches(current.id) : [];
  const modifiedCount = r.byItem.filter((i) => i.modified).length;
  const hits = schedules.reduce((a, s) => a + matches(s.id).length, 0);

  const devColor = (d: number) =>
    Math.abs(d) < 1
      ? 'var(--text-faint)'
      : d > 0
        ? 'var(--color-coral-500)'
        : 'var(--color-mint-600)';

  return (
    <>
      <Banner
        title="Line Items"
        subtitle="The full priced BOQ — every quantity, rate and annual figure"
        right={
          <Toggle
            value={kind}
            onChange={(v) => setKind(v as Kind)}
            options={[
              { value: 'capex', label: 'CAPEX' },
              { value: 'opex', label: 'OPEX' },
              { value: 'overhead', label: 'Overhead' },
            ]}
          />
        }
      />

      <HowTo
        id="explorer"
        purpose="The full priced BOQ, line by line. This is where you change an individual quantity, rate or annual figure."
        steps={[
          { do: 'Pick CAPEX / OPEX / Overhead', then: 'with the buttons in the header' },
          { do: 'Click a schedule on the left', then: 'its line items open on the right' },
          { do: 'Type in any white box', then: 'the totals update immediately' },
          { do: 'Use the Scale × box', then: 'to move every line in that schedule at once' },
          { do: 'Click ⟲', then: 'to put one line back to its tendered value' },
          { do: 'Search, or tick Modified only', then: 'to find a line or review just your changes' },
        ]}
        note="Edited cells turn teal. Editing while the Baseline scenario is selected creates a new scenario automatically — the tendered baseline can never be overwritten."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="inp max-w-[300px] !py-2"
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
        {(query || onlyModified) && (
          <span className="faint text-[12px]">
            {hits} matching line{hits === 1 ? '' : 's'} across {schedules.length} schedules
          </span>
        )}
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: railOpen ? '300px minmax(0, 1fr)' : 'minmax(0, 1fr)' }}
      >
        {/* ------------------------------------------------ schedule picker */}
        {railOpen && (
        <Card
          title="Schedules"
          subtitle={`${schedules.length} in ${kind.toUpperCase()}`}
          right={
            <button
              className="faint text-[13px] hover:!text-[color:var(--accent)]"
              title="Collapse the schedule list"
              onClick={() => setRailOpen(false)}
            >
              «
            </button>
          }
          bodyClass="p-2"
        >
          <div className="flex max-h-[640px] flex-col gap-0.5 overflow-y-auto">
            {schedules.map((s) => {
              const n = matches(s.id).length;
              const edited = Math.abs(s.exGst - s.baselineExGst) >= 1;
              const active = s.id === selected;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition"
                  style={active ? { background: 'var(--accent)', color: '#fff' } : undefined}
                >
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-[11.5px] font-bold"
                    style={
                      active
                        ? { background: 'rgb(255 255 255 / 0.2)', color: '#fff' }
                        : { background: 'var(--accent-soft)', color: 'var(--accent)' }
                    }
                  >
                    {s.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium">{s.name}</span>
                    <span
                      className="block text-[11px]"
                      style={{ color: active ? 'rgb(255 255 255 / 0.72)' : 'var(--text-faint)' }}
                    >
                      {n} line{n === 1 ? '' : 's'}
                      {edited && ' · edited'}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-[12px] font-semibold">
                    {crore(s.exGst, 1)}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
        )}

        {/* ------------------------------------------------------- detail */}
        {current ? (
          <Card
            title={
              <span className="flex items-center gap-2">
                {!railOpen && (
                  <button
                    className="faint text-[13px] hover:!text-[color:var(--accent)]"
                    title="Show the schedule list"
                    onClick={() => setRailOpen(true)}
                  >
                    »
                  </button>
                )}
                <span
                  className="grid size-6 place-items-center rounded-md text-[11px] font-bold text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  {current.id}
                </span>
                {current.name}
              </span>
            }
            subtitle={`${current.itemCount} line items · ${current.track} · tendered ${crore(current.baselineExGst)}`}
            right={
              <div className="flex items-center gap-4">
                {!railOpen && (
                  <select
                    className="inp !w-[200px] !py-1 !text-[12px]"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id} — {s.name}
                      </option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2 text-[12px]">
                  <span className="faint">Scale ×</span>
                  <NumberCell
                    value={overrides.scheduleMul[current.id] ?? 1}
                    baseline={1}
                    width="w-[72px]"
                    onChange={(v) => setScheduleMul(current.id, v <= 0 ? 1 : v)}
                    format={(v) => v.toFixed(2)}
                  />
                </label>
                <div className="text-right">
                  <p className="text-[16px] font-bold">
                    <Money value={current.exGst} />
                  </p>
                  <p
                    className="text-[11.5px] font-semibold"
                    style={{ color: devColor(current.exGst - current.baselineExGst) }}
                  >
                    {Math.abs(current.exGst - current.baselineExGst) < 1
                      ? 'as tendered'
                      : `${crore(current.exGst - current.baselineExGst)} vs tender`}
                  </p>
                </div>
              </div>
            }
            bodyClass="p-0"
          >
            <div className="scroll-x max-h-[640px] overflow-y-auto">
              {items.length === 0 ? (
                <Empty>No line items match the current filter.</Empty>
              ) : (
                <table className="grid">
                  <thead>
                    {kind === 'capex' ? (
                      <tr>
                        <th style={{ minWidth: 250 }}>Description</th>
                        <th>OEM</th>
                        <th className="r">Qty</th>
                        <th className="r">Unit rate ₹</th>
                        <th className="r">Amount</th>
                        <th className="r">vs tender</th>
                        <th />
                      </tr>
                    ) : kind === 'opex' ? (
                      <tr>
                        <th style={{ minWidth: 230 }}>Description</th>
                        {YEARS.map((y) => (
                          <th key={y} className="r">
                            Yr {y + 1} ₹
                          </th>
                        ))}
                        <th className="r">6-yr total</th>
                        <th />
                      </tr>
                    ) : (
                      <tr>
                        <th style={{ minWidth: 230 }}>Description</th>
                        <th className="r">Monthly Yr 1 ₹</th>
                        <th className="r">Escalation</th>
                        {YEARS.map((y) => (
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
                      const dev = it.exGst - it.baselineExGst;
                      const resetCell = (
                        <td className="r">
                          {it.modified && (
                            <button
                              className="faint text-[14px] hover:!text-[color:var(--accent)]"
                              title="Reset this line to its tendered value"
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
                          <tr key={it.id}>
                            <td className="max-w-[330px]">
                              <span className="block truncate" title={it.description}>
                                {it.description}
                              </span>
                            </td>
                            <td className="muted text-[12px]">{src.oem}</td>
                            <td className="r">
                              <NumberCell
                                value={ov?.qty ?? src.qty}
                                baseline={src.qty}
                                width="w-[80px]"
                                onChange={(v) => setItemOverride(it.id, { qty: v })}
                              />
                            </td>
                            <td className="r">
                              <NumberCell
                                value={ov?.unitRate ?? src.unitRate}
                                baseline={src.unitRate}
                                width="w-[124px]"
                                onChange={(v) => setItemOverride(it.id, { unitRate: v })}
                              />
                            </td>
                            <td className="r font-medium">
                              <Money value={it.exGst} />
                            </td>
                            <td
                              className="r text-[12px] font-semibold"
                              style={{ color: devColor(dev) }}
                            >
                              {Math.abs(dev) < 1 ? '—' : crore(dev)}
                            </td>
                            {resetCell}
                          </tr>
                        );
                      }

                      if (kind === 'opex') {
                        const src = opexById.get(it.id)!;
                        const ov = overrides.itemOverride[it.id];
                        const years = ov?.years ?? src.years;
                        return (
                          <tr key={it.id}>
                            <td className="max-w-[290px]">
                              <span className="block truncate" title={it.description}>
                                {it.description}
                              </span>
                              <span className="faint text-[11px]">{src.oem}</span>
                            </td>
                            {YEARS.map((y) => (
                              <td key={y} className="r">
                                {src.naYears.includes(y) ? (
                                  <span className="faint text-[12px]" title="Source reads NA">
                                    NA
                                  </span>
                                ) : (
                                  <NumberCell
                                    value={years[y]}
                                    baseline={src.years[y]}
                                    width="w-[104px]"
                                    onChange={(v) => {
                                      const next = years.slice();
                                      next[y] = v;
                                      setItemOverride(it.id, { years: next });
                                    }}
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
                          <td className="max-w-[270px]">
                            <span className="block truncate" title={it.description}>
                              {it.description}
                            </span>
                          </td>
                          <td className="r">
                            <NumberCell
                              value={ov?.monthlyY1 ?? src.monthlyY1}
                              baseline={src.monthlyY1}
                              width="w-[110px]"
                              onChange={(v) => setItemOverride(it.id, { monthlyY1: v })}
                            />
                          </td>
                          <td className="r">
                            <NumberCell
                              value={esc[0] * 100}
                              baseline={src.escPattern[0] * 100}
                              width="w-[68px]"
                              onChange={(v) =>
                                setItemOverride(it.id, { escPattern: new Array(5).fill(v / 100) })
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
                          {YEARS.map((y) => (
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

            {kind === 'overhead' && (
              <p className="faint border-t px-5 py-3 text-[11.5px] leading-relaxed">
                Each line starts from a Year 1 monthly figure, annualised at ×12, then escalated
                year on year at its own rate — 10% on the three rents, 5% on salaries and vehicles,
                2% on alternating years for electricity, 0% on the flat lines. In{' '}
                <strong>₹50 Cr lock</strong> mode (set on the Simulator) the block is rescaled to
                exactly ₹50.00 Cr, so editing a line changes the mix rather than the total.
              </p>
            )}
          </Card>
        ) : (
          <Card>
            <Empty>Select a schedule on the left.</Empty>
          </Card>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip tone="teal">{baseline.capexItems.length} CAPEX lines</Chip>
        <Chip tone="mint">{baseline.opexItems.length} OPEX lines</Chip>
        <Chip tone="violet">{baseline.overheadItems.length} overhead lines</Chip>
        {modifiedCount > 0 && <Chip tone="amber">{modifiedCount} edited</Chip>}
      </div>
    </>
  );
}
