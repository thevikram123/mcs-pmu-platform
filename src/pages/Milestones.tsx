import { useMemo, useState } from 'react';
import { Banner, Card, Chip, Empty, KpiTile, Money, Toggle } from '../components/ui';
import HowTo from '../components/HowTo';
import Timeline from '../components/Timeline';
import { PaymentCurve } from '../components/charts';
import {
  buildAnchors,
  deriveMilestones,
  milestones as data,
  PO_STATUSES,
  SETTABLE_STATUSES,
  STATUS_TONE,
  type DerivedMilestone,
  type SetStatus,
} from '../model/milestones';
import { crore, pct } from '../model/format';
import { useMilestones } from '../store/milestones';

const TABS = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'payments', label: 'Payment schedule' },
  { value: 'po', label: 'Purchase orders' },
  { value: 'terms', label: 'Contract terms' },
];

const shortDate = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
      })
    : '—';

export default function Milestones() {
  const store = useMilestones();
  const [tab, setTab] = useState('timeline');
  const [selected, setSelected] = useState<string | null>(null);
  const [poFilter, setPoFilter] = useState('');

  const rows = useMemo(
    () =>
      deriveMilestones(
        data,
        { dates: store.dates, status: store.status, t4: store.t4 ?? undefined },
        store.asOf,
      ),
    [store.dates, store.status, store.t4, store.asOf],
  );

  const total = data.checksums.paymentTotalInclGst;
  const paidAmt = rows.filter((r) => r.status === 'Paid').reduce((a, r) => a + (r.amountInclGst ?? 0), 0);
  const statusesSet = rows.filter((r) => r.statusModified).length;
  const dueAmt = rows.filter((r) => r.status === 'Due').reduce((a, r) => a + (r.amountInclGst ?? 0), 0);
  const fromT4 = rows.filter((r) => r.fromT4);
  const t4 = store.t4 ?? data.assumedT4;
  const anchors = buildAnchors(data, t4);
  const modifiedDates = rows.filter((r) => r.dateModified).length;

  const curve = useMemo(() => {
    const dated = rows.filter((r) => r.date && r.amountInclGst).sort((a, b) => a.date!.localeCompare(b.date!));
    let cum = 0;
    return dated.map((r) => {
      cum += r.amountInclGst ?? 0;
      return { date: r.date!, label: `${r.id} · ${shortDate(r.date)}`, cumulative: cum, event: r.amountInclGst ?? 0 };
    });
  }, [rows]);

  const poKey = (i: (typeof data.poItems)[number], idx: number) => `${i.milestoneId}-${i.itemNo}-${idx}`;
  const poRows = data.poItems.map((i, idx) => {
    const key = poKey(i, idx);
    return {
      ...i,
      key,
      status: store.poStatus[key] ?? i.status,
      poTargetDate: store.poDates[key] ?? i.poTargetDate,
      dateModified: store.poDates[key] != null,
      statusModified: store.poStatus[key] != null,
    };
  });
  const q = poFilter.trim().toLowerCase();
  const poVisible = q
    ? poRows.filter(
        (i) =>
          (i.description ?? '').toLowerCase().includes(q) ||
          (i.milestone ?? '').toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      )
    : poRows;
  const poPlaced = poRows.filter((i) => i.status !== 'Pending').length;

  const setDate = (m: DerivedMilestone, v: string) =>
    store.setDate(m.id, v === '' || v === m.sourceDate ? null : v);

  return (
    <>
      <Banner
        title="Milestone Tracker"
        subtitle="The 29 contractual payment milestones, their dates, and the purchase orders behind them"
        right={
          <div className="flex items-center gap-2">
            <label className="text-[12px] text-white/70">As of</label>
            <input
              type="date"
              className="inp !w-[142px] !border-white/25 !bg-white/12 !py-1.5 !text-white"
              value={store.asOf}
              onChange={(e) => store.setAsOf(e.target.value)}
            />
          </div>
        }
      />

      <HowTo
        id="milestones"
        purpose="What the client pays, when, and against which deliverable — plus the 321 purchase orders that have to be placed to hit those dates."
        steps={[
          { do: 'Read the timeline', then: 'each dot is a payment; size is its value, colour is its status' },
          { do: 'Click a dot', then: 'to see the milestone, its amount and its deliverable' },
          { do: 'Open Payment schedule', then: 'and type a date to override the contractual one' },
          { do: 'Set a status', then: 'from Not started through to Paid — it overrides the automatic one' },
          { do: 'Open Purchase orders', then: 'to set PO status and target dates per line item' },
        ]}
        note="Status is worked out from the date until you set one; choosing a value records where the milestone actually is and the automatic reading is kept underneath. Dates behave the same way — what you type is marked modified and never overwrites the contractual date."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile
          label="Contract value"
          value={crore(total)}
          sub="29 milestones · 100% of TCV"
          icon={<span className="text-lg">Σ</span>}
          tone="teal"
        />
        <KpiTile
          label="Paid"
          value={crore(paidAmt)}
          sub={`${pct(paidAmt / total, 1)} of contract`}
          icon={<span className="text-lg">✓</span>}
          tone="mint"
        />
        <KpiTile
          label="Due now"
          value={crore(dueAmt)}
          sub={`on or before ${shortDate(store.asOf)}`}
          icon={<span className="text-lg">!</span>}
          tone={dueAmt > 0 ? 'coral' : 'slate'}
        />
        <KpiTile
          label="Depends on T4"
          value={crore(fromT4.reduce((a, r) => a + (r.amountInclGst ?? 0), 0))}
          sub={`${fromT4.length} milestones · New CCC handover`}
          icon={<span className="text-lg">?</span>}
          tone="amber"
        />
        <KpiTile
          label="Purchase orders"
          value={`${poPlaced} / ${poRows.length}`}
          sub="moved off Pending"
          icon={<span className="text-lg">⛁</span>}
          tone="violet"
        />
      </div>

      <Card
        title={TABS.find((t) => t.value === tab)!.label}
        subtitle={
          tab === 'timeline'
            ? 'Payment events on a shared date axis, by track'
            : tab === 'payments'
              ? 'Every milestone, its contractual timing and what it releases'
              : tab === 'po'
                ? `${poVisible.length} of ${poRows.length} purchase-order line items`
                : 'Anchors, clauses and how these figures were verified'
        }
        right={
          <div className="flex items-center gap-3">
            {modifiedDates > 0 && (
              <button className="chip hover:!border-[color:var(--accent)]" onClick={store.resetDates}>
                {modifiedDates} date{modifiedDates === 1 ? '' : 's'} modified ⟲
              </button>
            )}
            {statusesSet > 0 && (
              <span className="chip">{statusesSet} status set</span>
            )}
            <Toggle value={tab} onChange={setTab} options={TABS} />
          </div>
        }
        bodyClass={tab === 'payments' || tab === 'po' ? 'p-0' : 'p-5'}
      >
        {/* ------------------------------------------------------ timeline */}
        {tab === 'timeline' && (
          <>
            <Timeline milestones={rows} asOf={store.asOf} selected={selected} onSelect={setSelected} />
            <div className="mt-6 border-t pt-5">
              <p className="faint mb-3 text-[11px] font-bold uppercase tracking-[0.12em]">
                Cumulative value released
              </p>
              <PaymentCurve data={curve} height={280} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {(['Due', 'Upcoming', ...SETTABLE_STATUSES] as const).map((s) => (
                <span key={s} className="flex items-center gap-1.5 text-[12px]">
                  <i className="size-2.5 rounded-full" style={{ background: STATUS_TONE[s] }} />
                  <span className="muted">{s}</span>
                  <span className="font-semibold">{rows.filter((r) => r.status === s).length}</span>
                </span>
              ))}
            </div>
          </>
        )}

        {/* ----------------------------------------------------- payments */}
        {tab === 'payments' && (
          <div className="scroll-x">
            <table className="grid">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Track</th>
                  <th style={{ minWidth: 240 }}>Milestone</th>
                  <th>MSA timing</th>
                  <th className="r">% of TCV</th>
                  <th className="r">×</th>
                  <th className="r">Amount incl. GST</th>
                  <th className="r">Cumulative</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} style={selected === m.id ? { background: 'var(--accent-soft)' } : undefined}>
                    <td>
                      <button className="font-semibold" onClick={() => setSelected(m.id)}>
                        {m.id}
                      </button>
                    </td>
                    <td className="muted text-[12px]">{m.track}</td>
                    <td className="max-w-[300px]">
                      <span className="block truncate" title={m.name}>
                        {m.name}
                      </span>
                      {m.deliverable && (
                        <span className="faint block truncate text-[11px]" title={m.deliverable}>
                          {m.deliverable}
                        </span>
                      )}
                    </td>
                    <td className="muted text-[12px]">{m.timeline}</td>
                    <td className="r muted">{m.pctOfTcv ? pct(m.pctOfTcv, 2) : '—'}</td>
                    <td className="r muted">{m.times ?? '—'}</td>
                    <td className="r font-medium">
                      {m.amountInclGst ? <Money value={m.amountInclGst} /> : '—'}
                    </td>
                    <td className="r muted">{pct(m.cumulativePct, 1)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <input
                          type="date"
                          className="inp !w-[136px] !py-1"
                          style={
                            m.dateModified
                              ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 }
                              : undefined
                          }
                          value={m.date ?? ''}
                          title={
                            m.dateModified
                              ? `Modified. Contractual: ${m.sourceDate ?? 'not date-certain'} (${m.basis})`
                              : `Derived from ${m.basis}`
                          }
                          onChange={(e) => setDate(m, e.target.value)}
                        />
                        {m.dateModified && (
                          <button
                            className="faint text-[13px] hover:!text-[color:var(--accent)]"
                            title={`Reset to contractual date (${m.sourceDate ?? 'none'})`}
                            onClick={() => store.setDate(m.id, null)}
                          >
                            ⟲
                          </button>
                        )}
                      </div>
                      {m.dateModified ? (
                        <span
                          className="text-[10.5px] font-semibold"
                          style={{ color: 'var(--accent)' }}
                        >
                          modified · was {m.sourceDate ? shortDate(m.sourceDate) : '—'}
                        </span>
                      ) : (
                        m.fromT4 && <span className="faint text-[10.5px]">follows T4</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <i
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: STATUS_TONE[m.status] }}
                        />
                        <select
                          className="inp !w-[168px] !py-1"
                          style={
                            m.statusModified
                              ? {
                                  borderColor: STATUS_TONE[m.status],
                                  color: STATUS_TONE[m.status],
                                  fontWeight: 600,
                                }
                              : undefined
                          }
                          value={m.statusModified ? m.status : ''}
                          title={
                            m.statusModified
                              ? `Set by hand. The schedule says ${m.derivedStatus}.`
                              : `Derived from the date — ${m.derivedStatus}`
                          }
                          onChange={(e) =>
                            store.setStatus(m.id, (e.target.value || null) as SetStatus | null)
                          }
                        >
                          <option value="">{m.derivedStatus} (auto)</option>
                          {SETTABLE_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                  <td colSpan={6}>TOTAL — 29 milestones</td>
                  <td className="r">
                    <Money value={total} />
                  </td>
                  <td className="r">{pct(data.checksums.paymentPctTotal, 1)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
            <p className="faint border-t px-5 py-3 text-[11.5px] leading-relaxed">
              Dates are derived from the MSA time anchors (T = {data.anchors.T}, T1 ={' '}
              {data.anchors.T1}, T2 = {data.anchors.T2}). M28 and M29 hang off T4 — the handover
              of the new control room — which the contract never fixes, so they are dated from the
              delivery plans instead and marked in violet; the two plans disagree by six months
              and the link switches between them. A date you type is marked modified and shown
              against the source date; it never replaces it.
            </p>
          </div>
        )}

        {/* ----------------------------------------------------------- PO */}
        {tab === 'po' && (
          <>
            <div className="flex flex-wrap items-center gap-3 px-5 py-3">
              <input
                className="inp max-w-[300px] !py-2"
                placeholder="Search item, milestone or category…"
                value={poFilter}
                onChange={(e) => setPoFilter(e.target.value)}
              />
              <span className="faint text-[12px]">
                {poPlaced} of {poRows.length} moved off Pending
              </span>
            </div>
            <div className="scroll-x max-h-[620px] overflow-y-auto">
              {poVisible.length === 0 ? (
                <Empty>No purchase-order items match that search.</Empty>
              ) : (
                <table className="grid">
                  <thead>
                    <tr>
                      <th>MS</th>
                      <th style={{ minWidth: 180 }}>Milestone</th>
                      <th>Category</th>
                      <th className="r">#</th>
                      <th style={{ minWidth: 240 }}>Item</th>
                      <th>PO target date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poVisible.map((i) => (
                      <tr key={i.key}>
                        <td className="font-semibold">{i.newId ?? i.milestoneId}</td>
                        <td className="muted max-w-[220px] text-[12px]">
                          <span className="block truncate" title={i.milestone ?? ''}>
                            {i.milestone}
                          </span>
                        </td>
                        <td>
                          <Chip>{i.category}</Chip>
                        </td>
                        <td className="r muted">{i.itemNo}</td>
                        <td className="max-w-[320px]">
                          <span className="block truncate" title={i.description ?? ''}>
                            {i.description}
                          </span>
                        </td>
                        <td>
                          <input
                            type="date"
                            className="inp !w-[136px] !py-1"
                            style={
                              i.dateModified
                                ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 }
                                : undefined
                            }
                            value={
                              i.poTargetDate && /^\d{4}-\d{2}-\d{2}$/.test(i.poTargetDate)
                                ? i.poTargetDate
                                : ''
                            }
                            title={i.dateModified ? 'Modified from the tracker date' : i.poTargetDate ?? ''}
                            onChange={(e) => store.setPoDate(i.key, e.target.value || null)}
                          />
                        </td>
                        <td>
                          <select
                            className="inp !w-[124px] !py-1"
                            style={
                              i.statusModified
                                ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 }
                                : undefined
                            }
                            value={i.status}
                            onChange={(e) => store.setPoStatus(i.key, e.target.value)}
                          >
                            {PO_STATUSES.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* -------------------------------------------------------- terms */}
        {tab === 'terms' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <div
                className="rounded-[12px] px-5 py-4"
                style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-[13.5px] font-semibold">
                      T4 — handover of the new control room
                    </h3>
                    <p className="muted mt-0.5 max-w-2xl text-[12px] leading-relaxed">
                      {data.t4Basis}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="inp !w-[152px] !py-1.5"
                      style={
                        store.t4
                          ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 }
                          : undefined
                      }
                      value={t4}
                      onChange={(e) => store.setT4(e.target.value || null)}
                    />
                    {store.t4 && (
                      <button
                        className="faint text-[14px] hover:!text-[color:var(--accent)]"
                        title={`Reset to the planning default (${data.assumedT4})`}
                        onClick={() => store.setT4(null)}
                      >
                        ⟲
                      </button>
                    )}
                  </div>
                </div>
                <p className="faint mt-2.5 text-[11.5px] leading-relaxed">
                  {data.governance.resolutionOfT4}
                </p>
                <p className="mt-2 text-[12px] font-medium">
                  Sets T5 = {shortDate(anchors.T5)} and T6 = {shortDate(anchors.T6)}, dating{' '}
                  {fromT4.length} milestones worth{' '}
                  {crore(fromT4.reduce((a, r) => a + (r.amountInclGst ?? 0), 0))}.
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-[13.5px] font-semibold">Time anchors</h3>
              <p className="faint mt-1 text-[12px]">
                The MSA states milestone timing relative to these, not as calendar dates.
              </p>
              <table className="grid mt-3">
                <thead>
                  <tr>
                    <th>Anchor</th>
                    <th>Definition</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.governance.anchorDefinitions.map((a) => (
                    <tr key={a.anchor}>
                      <td className="font-semibold">{a.anchor}</td>
                      <td className="muted">{a.definition}</td>
                      <td className="tnum">
                        {anchors[a.anchor] ? (
                          shortDate(anchors[a.anchor]!)
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="text-[13.5px] font-semibold">Governing clauses</h3>
              <ul className="mt-3 flex flex-col gap-3.5">
                {data.governance.clauses.map((c) => (
                  <li key={c.title}>
                    <div className="flex items-baseline gap-2">
                      <p className="text-[12.5px] font-semibold">{c.title}</p>
                      <span className="faint font-mono text-[10.5px]">{c.ref}</span>
                    </div>
                    <p className="muted mt-0.5 text-[12px] leading-relaxed">{c.text}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-2">
              <h3 className="text-[13.5px] font-semibold">Where the documents differ</h3>
              <p className="faint mt-1 text-[12px]">
                The MSA is the governing document — it post-dates the RFP and all four
                corrigendums, and it wins wherever they conflict.
              </p>
              <table className="grid mt-3">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Earlier document</th>
                    <th>Position in force</th>
                    <th>Resolved by</th>
                  </tr>
                </thead>
                <tbody>
                  {data.governance.amendments.map((a) => (
                    <tr key={a.item}>
                      <td className="font-medium">{a.item}</td>
                      <td className="muted">{a.rfp}</td>
                      <td className="font-semibold">{a.final}</td>
                      <td className="muted">{a.via}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:col-span-2">
              <h3 className="text-[13.5px] font-semibold">Verification & data notes</h3>
              <p className="muted mt-2 text-[12.5px] leading-relaxed">
                {data.governance.verification}
              </p>
              <ul className="mt-4 flex flex-col gap-4">
                {data.dataQuality.map((n) => (
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
        Sources: {data.meta.sources.join(', ')}, verified against the 38 signed MSA page scans.
      </p>
    </>
  );
}
