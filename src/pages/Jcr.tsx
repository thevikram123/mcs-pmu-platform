import { useMemo, useState } from 'react';
import { Banner, Card, Chip, Empty, KpiTile, Money, NumberCell, Toggle } from '../components/ui';
import { RankBar } from '../components/charts';
import { baseline, useResult } from '../model/useModel';
import { crore, num, pct } from '../model/format';
import { deriveRow, EMPTY_ENTRY, useJcr, type ChangeOrder } from '../store/jcr';

const STATUSES: ChangeOrder['status'][] = [
  'Draft',
  'Raised',
  'PIC Review',
  'HPC Approved',
  'Rejected',
];

export default function Jcr() {
  const r = useResult();
  const jcr = useJcr();
  const [tab, setTab] = useState('codes');

  /**
   * Original Budget follows the *active scenario*, not the frozen tracker value,
   * so a re-priced scenario and its job cost report stay consistent.
   */
  const budgetFor = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of r.bySchedule) m.set(s.id, s.exGst);
    // Schedule A is split A-T1 / A-T2 and E into E-T1 / E-T2 in the tracker;
    // apportion the scenario's schedule total on the tendered split.
    const out = new Map<string, number>();
    for (const c of baseline.jcrCostCodes) {
      const base = c.code.split('-')[0];
      const siblings = baseline.jcrCostCodes.filter((x) => x.code.split('-')[0] === base);
      const sched = m.get(base) ?? 0;
      const denom = siblings.reduce((a, x) => a + x.budgetExGst, 0);
      out.set(c.code, denom > 0 ? sched * (c.budgetExGst / denom) : sched);
    }
    return out;
  }, [r.bySchedule]);

  const rows = baseline.jcrCostCodes.map((c) =>
    deriveRow(
      c.code,
      c.description ?? '',
      c.track ?? '',
      budgetFor.get(c.code) ?? 0,
      jcr.entries[c.code] ?? EMPTY_ENTRY,
      jcr.approvedCosFor(c.code),
    ),
  );

  const tot = rows.reduce(
    (a, x) => ({
      originalBudget: a.originalBudget + x.originalBudget,
      approvedCos: a.approvedCos + x.approvedCos,
      revisedBudget: a.revisedBudget + x.revisedBudget,
      committed: a.committed + x.committed,
      actual: a.actual + x.actual,
      estFinalCost: a.estFinalCost + x.estFinalCost,
      variance: a.variance + x.variance,
    }),
    {
      originalBudget: 0,
      approvedCos: 0,
      revisedBudget: 0,
      committed: 0,
      actual: 0,
      estFinalCost: 0,
      variance: 0,
    },
  );

  const filled = Object.keys(jcr.entries).length;
  const topVariance = rows
    .filter((x) => Math.abs(x.variance) > 1)
    .sort((a, x) => Math.abs(x.variance) - Math.abs(a.variance))
    .slice(0, 10)
    .map((x) => ({ key: x.code, exGst: Math.abs(x.variance) }));

  return (
    <>
      <Banner
        title="Job Cost Report"
        subtitle="Committed and actual cost against the active scenario's budget"
        right={
          <div className="flex items-center gap-2">
            <label className="text-[12px] text-white/70">As of</label>
            <input
              type="date"
              className="inp !w-[142px] !border-white/25 !bg-white/12 !py-1.5 !text-white"
              value={jcr.asOf}
              onChange={(e) => jcr.setAsOf(e.target.value)}
            />
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile
          label="Revised budget"
          value={crore(tot.revisedBudget)}
          sub={`incl. ${crore(tot.approvedCos)} approved COs`}
          icon={<span className="text-lg">Σ</span>}
          tone="teal"
        />
        <KpiTile
          label="Committed"
          value={crore(tot.committed)}
          sub={pct(tot.revisedBudget ? tot.committed / tot.revisedBudget : 0)}
          icon={<span className="text-lg">◧</span>}
          tone="violet"
        />
        <KpiTile
          label="Actual to date"
          value={crore(tot.actual)}
          sub={pct(tot.revisedBudget ? tot.actual / tot.revisedBudget : 0)}
          icon={<span className="text-lg">●</span>}
          tone="mint"
        />
        <KpiTile
          label="Est. final cost"
          value={crore(tot.estFinalCost)}
          sub="actual + est. to complete"
          icon={<span className="text-lg">→</span>}
          tone="amber"
        />
        <KpiTile
          label="Variance"
          value={Math.abs(tot.variance) < 1 ? '—' : crore(tot.variance)}
          sub={tot.variance >= 0 ? 'under budget' : 'over budget'}
          icon={<span className="text-lg">Δ</span>}
          tone={tot.variance < 0 ? 'coral' : 'slate'}
        />
      </div>

      <div className="mb-4 flex items-center gap-3">
        <Toggle
          value={tab}
          onChange={setTab}
          options={[
            { value: 'codes', label: 'Cost codes' },
            { value: 'co', label: `Change orders (${jcr.changeOrders.length})` },
            { value: 'vendor', label: 'By vendor' },
          ]}
        />
        <span className="faint text-[12px]">
          {filled} of {rows.length} codes have entries
        </span>
        {filled > 0 && (
          <button
            className="faint ml-auto text-[12px] hover:underline"
            onClick={() => {
              if (confirm('Clear all committed / actual entries and change orders?')) jcr.clearAll();
            }}
          >
            Clear all entries
          </button>
        )}
      </div>

      {tab === 'codes' && (
        <Card bodyClass="p-0">
          <div className="scroll-x">
            <table className="grid">
              <thead>
                <tr>
                  <th>Code</th>
                  <th style={{ minWidth: 200 }}>Description</th>
                  <th className="r">Orig. budget</th>
                  <th className="r">Approved COs</th>
                  <th className="r">Revised</th>
                  <th className="r">Committed ₹</th>
                  <th className="r">% Comm.</th>
                  <th className="r">Actual ₹</th>
                  <th className="r">% Compl.</th>
                  <th className="r">Est. to compl.</th>
                  <th className="r">EFC</th>
                  <th className="r">Variance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => {
                  const e = jcr.entries[x.code] ?? EMPTY_ENTRY;
                  return (
                    <tr key={x.code}>
                      <td className="font-semibold">{x.code}</td>
                      <td className="max-w-[260px]">
                        <span className="block truncate" title={x.description}>
                          {x.description}
                        </span>
                        <span className="faint text-[11px]">{x.track}</span>
                      </td>
                      <td className="r muted">{crore(x.originalBudget)}</td>
                      <td className="r muted">
                        {x.approvedCos === 0 ? '—' : crore(x.approvedCos)}
                      </td>
                      <td className="r font-medium">
                        <Money value={x.revisedBudget} />
                      </td>
                      <td className="r">
                        <NumberCell
                          value={e.committed}
                          width="w-[112px]"
                          onChange={(v) => jcr.setEntry(x.code, { committed: v })}
                          format={(v) => num(v, 0)}
                        />
                      </td>
                      <td className="r muted">{pct(x.pctCommitted)}</td>
                      <td className="r">
                        <NumberCell
                          value={e.actual}
                          width="w-[112px]"
                          onChange={(v) => jcr.setEntry(x.code, { actual: v })}
                          format={(v) => num(v, 0)}
                        />
                      </td>
                      <td className="r">
                        <NumberCell
                          value={e.percentComplete * 100}
                          width="w-[64px]"
                          onChange={(v) =>
                            jcr.setEntry(x.code, {
                              percentComplete: Math.min(100, Math.max(0, v)) / 100,
                            })
                          }
                          format={(v) => `${v.toFixed(0)}%`}
                        />
                      </td>
                      <td className="r muted">{crore(x.estToComplete)}</td>
                      <td className="r font-medium">{crore(x.estFinalCost)}</td>
                      <td
                        className="r font-semibold"
                        style={{
                          color:
                            Math.abs(x.variance) < 1
                              ? 'var(--text-faint)'
                              : x.variance < 0
                                ? 'var(--color-coral-500)'
                                : 'var(--color-mint-600)',
                        }}
                      >
                        {Math.abs(x.variance) < 1 ? '—' : crore(x.variance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                  <td colSpan={2}>TOTAL</td>
                  <td className="r">{crore(tot.originalBudget)}</td>
                  <td className="r">{crore(tot.approvedCos)}</td>
                  <td className="r">{crore(tot.revisedBudget)}</td>
                  <td className="r">{crore(tot.committed)}</td>
                  <td className="r">
                    {pct(tot.revisedBudget ? tot.committed / tot.revisedBudget : 0)}
                  </td>
                  <td className="r">{crore(tot.actual)}</td>
                  <td className="r">
                    {pct(tot.revisedBudget ? tot.actual / tot.revisedBudget : 0)}
                  </td>
                  <td className="r">{crore(tot.estFinalCost - tot.actual)}</td>
                  <td className="r">{crore(tot.estFinalCost)}</td>
                  <td className="r">{Math.abs(tot.variance) < 1 ? '—' : crore(tot.variance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="faint border-t px-5 py-3 text-[11.5px] leading-relaxed">
            Estimated cost to complete uses the tracker's own formula: where % complete is above
            zero, <code>MAX(Actual ÷ %Complete − Actual, 0)</code>; otherwise the remaining revised
            budget. Entries are held in this browser only — export from the Scenarios page to share
            them.
          </p>
        </Card>
      )}

      {tab === 'co' && (
        <Card
          title="Change order log"
          subtitle="Per MSA clause 4.1. Only HPC-approved CRs feed the revised budget."
          right={
            <button className="btn btn-primary" onClick={() => jcr.addChangeOrder()}>
              + Add CR
            </button>
          }
          bodyClass="p-0"
        >
          {jcr.changeOrders.length === 0 ? (
            <Empty>No change orders logged. Add one to track a variation against a cost code.</Empty>
          ) : (
            <div className="scroll-x">
              <table className="grid">
                <thead>
                  <tr>
                    <th>CR #</th>
                    <th>Raised</th>
                    <th style={{ minWidth: 220 }}>Description</th>
                    <th>Cost code</th>
                    <th className="r">Budget impact ₹</th>
                    <th>Status</th>
                    <th>PIC date</th>
                    <th>HPC date</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {jcr.changeOrders.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <input
                          className="inp w-[86px] !py-1"
                          value={c.cr}
                          onChange={(e) => jcr.updateChangeOrder(c.id, { cr: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="inp w-[132px] !py-1"
                          value={c.dateRaised}
                          onChange={(e) =>
                            jcr.updateChangeOrder(c.id, { dateRaised: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="inp !py-1"
                          placeholder="What changed and why"
                          value={c.description}
                          onChange={(e) =>
                            jcr.updateChangeOrder(c.id, { description: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <select
                          className="inp w-[92px] !py-1"
                          value={c.costCode}
                          onChange={(e) =>
                            jcr.updateChangeOrder(c.id, { costCode: e.target.value })
                          }
                        >
                          <option value="">—</option>
                          {baseline.jcrCostCodes.map((k) => (
                            <option key={k.code} value={k.code}>
                              {k.code}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="r">
                        <NumberCell
                          value={c.budgetImpact}
                          width="w-[124px]"
                          onChange={(v) => jcr.updateChangeOrder(c.id, { budgetImpact: v })}
                          format={(v) => num(v, 0)}
                        />
                      </td>
                      <td>
                        <select
                          className="inp w-[126px] !py-1"
                          value={c.status}
                          onChange={(e) =>
                            jcr.updateChangeOrder(c.id, {
                              status: e.target.value as ChangeOrder['status'],
                            })
                          }
                        >
                          {STATUSES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="date"
                          className="inp w-[132px] !py-1"
                          value={c.picDate}
                          onChange={(e) => jcr.updateChangeOrder(c.id, { picDate: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="inp w-[132px] !py-1"
                          value={c.hpcDate}
                          onChange={(e) => jcr.updateChangeOrder(c.id, { hpcDate: e.target.value })}
                        />
                      </td>
                      <td className="r">
                        <button
                          className="faint text-[14px] hover:!text-[color:var(--color-coral-500)]"
                          title="Delete this CR"
                          onClick={() => jcr.removeChangeOrder(c.id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'vendor' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card
            title="Budget by OEM"
            subtitle="Current scenario, all blocks"
            bodyClass="p-0"
            className="lg:col-span-1"
          >
            <div className="scroll-x max-h-[560px] overflow-y-auto">
              <table className="grid">
                <thead>
                  <tr>
                    <th>OEM / Vendor</th>
                    <th className="r">Budget excl. GST</th>
                    <th className="r">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byOem.map((v) => (
                    <tr key={v.key}>
                      <td>{v.key}</td>
                      <td className="r">
                        <Money value={v.exGst} />
                      </td>
                      <td className="r muted">{pct(v.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Largest variances" subtitle="Absolute variance by cost code">
            {topVariance.length ? (
              <RankBar data={topVariance} height={520} color={() => '#f43f5e'} />
            ) : (
              <Empty>
                No variances yet. Enter committed or actual cost against a code to see it here.
              </Empty>
            )}
          </Card>
        </div>
      )}

      {tab !== 'vendor' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip tone="teal">{baseline.jcrCostCodes.length} cost codes</Chip>
          <Chip tone="violet">{baseline.vendors.length} vendors in source tracker</Chip>
          <Chip>Saved in this browser</Chip>
        </div>
      )}
    </>
  );
}
