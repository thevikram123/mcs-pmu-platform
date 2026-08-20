import { useRef, useState } from 'react';
import { Banner, Card, Chip, Empty, Money } from '../components/ui';
import { CompareChart, CostOverTime } from '../components/charts';
import HowTo from '../components/HowTo';
import { baseline, useResult } from '../model/useModel';
import { computeScenario, countChanges } from '../model/engine';
import { crore, deltaCr, pct } from '../model/format';
import { BASELINE_ID, useScenarios } from '../store/scenarios';
import { useJcr } from '../store/jcr';
// SheetJS and jsPDF are ~1 MB between them and are only needed when the user
// actually exports, so they are pulled in on demand rather than at first paint.
import { safeFilename } from '../export/filename';
import type { Scenario } from '../model/types';

export default function Scenarios() {
  const result = useResult();
  const store = useScenarios();
  const jcr = useJcr();
  const active = store.active();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const compare = store.compareId ? store.byId(store.compareId) : undefined;
  const compareResult = compare ? computeScenario(baseline, compare.overrides) : undefined;

  const note = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 4000);
  };

  async function exportExcel() {
    setBusy('xlsx');
    try {
      const { buildWorkbook, downloadWorkbook } = await import('../export/xlsx');
      const wb = buildWorkbook(
        baseline,
        active,
        result,
        { asOf: jcr.asOf, entries: jcr.entries, changeOrders: jcr.changeOrders },
        compare && compareResult ? { name: compare.name, result: compareResult } : undefined,
      );
      downloadWorkbook(wb, safeFilename(active.name, 'xlsx'));
      note('Excel workbook downloaded.');
    } catch (e) {
      note(`Excel export failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy('pdf');
    try {
      const { buildPdf, captureCharts } = await import('../export/pdf');
      const charts = await captureCharts(2);
      const doc = await buildPdf(baseline, active, result, charts);
      doc.save(safeFilename(active.name, 'pdf'));
      note('PDF report downloaded.');
    } catch (e) {
      note(`PDF export failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  function exportJson() {
    const payload = {
      kind: 'mcs-pmu-scenario',
      version: 1,
      exportedAt: new Date().toISOString(),
      scenario: active,
      jcr: { asOf: jcr.asOf, entries: jcr.entries, changeOrders: jcr.changeOrders },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = safeFilename(active.name, 'json');
    a.click();
    URL.revokeObjectURL(a.href);
    note('Scenario JSON downloaded — send this to share the scenario and JCR entries.');
  }

  async function importJson(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (data.kind !== 'mcs-pmu-scenario' || !data.scenario) {
        note('That file is not an MCS scenario export.');
        return;
      }
      store.importScenario(data.scenario as Scenario);
      if (data.jcr && confirm('Also replace the Job Cost Report entries in this browser?')) {
        jcr.replaceAll(data.jcr);
      }
      note('Scenario imported and made active.');
    } catch (e) {
      note(`Import failed: ${(e as Error).message}`);
    }
  }

  const rows = store.scenarios.map((s) => {
    const res = s.id === active.id ? result : computeScenario(baseline, s.overrides);
    return { s, res, changes: countChanges(s.overrides) };
  });
  const baseRow = rows.find((r) => r.s.id === BASELINE_ID)!;

  return (
    <>
      <Banner
        title="Scenarios & Export"
        subtitle="Save variants, compare them side by side, and export for review"
        right={
          <div className="flex items-center gap-2">
            <button
              className="btn !border-white/25 !bg-white/12 !text-white"
              disabled={busy !== null}
              onClick={exportExcel}
            >
              {busy === 'xlsx' ? 'Building…' : '⬇ Excel'}
            </button>
            <button
              className="btn !border-white/25 !bg-white/12 !text-white"
              disabled={busy !== null}
              onClick={exportPdf}
            >
              {busy === 'pdf' ? 'Building…' : '⬇ PDF'}
            </button>
          </div>
        }
      />

      {msg && (
        <div
          className="mb-4 rounded-lg px-4 py-2.5 text-[13px] font-medium"
          style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}
        >
          {msg}
        </div>
      )}

      <HowTo
        id="scenarios"
        purpose="Keep several versions of the budget side by side, compare any two, and produce the Excel or PDF you hand to someone else."
        steps={[
          { do: 'Click a scenario name', then: 'to make it the one you are working on' },
          { do: 'Click ⇄ on another', then: 'to compare the two at the bottom of the page' },
          { do: 'Download Excel', then: 'a full multi-sheet workbook of this scenario' },
          { do: 'Download PDF', then: 'a report with charts and an assumptions appendix' },
          { do: 'Use ⎘ ✎ ✕', then: 'to duplicate, rename or delete a scenario' },
          { do: 'Download / Import JSON', then: 'to move a scenario between browsers or people' },
        ]}
        note="Everything lives in this browser. The Baseline row is the tendered BOQ and cannot be edited or deleted."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Saved scenarios"
          subtitle="The baseline is the tendered BOQ and can never be edited — the first change forks a new scenario"
          right={
            <div className="flex gap-2">
              <button
                className="btn"
                onClick={() => {
                  const n = prompt('Name for the new scenario:', `Scenario ${store.scenarios.length}`);
                  if (n) store.create(n, active.id);
                }}
              >
                + New from active
              </button>
              <button className="btn" onClick={() => fileRef.current?.click()}>
                Import JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importJson(f);
                  e.target.value = '';
                }}
              />
            </div>
          }
          bodyClass="p-0"
        >
          <div className="scroll-x">
            <table className="grid">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th className="r">Changes</th>
                  <th className="r">CAPEX</th>
                  <th className="r">OPEX</th>
                  <th className="r">Overhead</th>
                  <th className="r">Total excl. GST</th>
                  <th className="r">vs baseline</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, res, changes }) => {
                  const dev = res.totals.exGst - baseRow.res.totals.exGst;
                  const isActive = s.id === active.id;
                  return (
                    <tr
                      key={s.id}
                      style={
                        isActive
                          ? { background: 'var(--accent-soft)', fontWeight: 600 }
                          : undefined
                      }
                    >
                      <td>
                        <button
                          className="text-left"
                          onClick={() => store.setActive(s.id)}
                          title="Make active"
                        >
                          <span className="block">{s.name}</span>
                          {s.note && <span className="faint block text-[11px]">{s.note}</span>}
                        </button>
                      </td>
                      <td className="r muted">{s.id === BASELINE_ID ? '—' : changes}</td>
                      <td className="r muted">{crore(res.totals.capex)}</td>
                      <td className="r muted">{crore(res.totals.opex)}</td>
                      <td className="r muted">{crore(res.totals.overhead)}</td>
                      <td className="r">
                        <Money value={res.totals.exGst} />
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
                        {Math.abs(dev) < 1 ? '—' : deltaCr(dev)}
                      </td>
                      <td className="muted text-[12px]">
                        {new Date(s.updatedAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="r whitespace-nowrap">
                        <button
                          className="faint px-1 text-[13px] hover:!text-[color:var(--accent)]"
                          title="Duplicate"
                          onClick={() => store.duplicate(s.id)}
                        >
                          ⎘
                        </button>
                        <button
                          className="faint px-1 text-[13px] hover:!text-[color:var(--accent)]"
                          title="Compare against active"
                          onClick={() =>
                            store.setCompare(store.compareId === s.id ? null : s.id)
                          }
                          style={
                            store.compareId === s.id ? { color: 'var(--accent)' } : undefined
                          }
                        >
                          ⇄
                        </button>
                        {s.id !== BASELINE_ID && (
                          <>
                            <button
                              className="faint px-1 text-[13px] hover:!text-[color:var(--accent)]"
                              title="Rename"
                              onClick={() => {
                                const n = prompt('Scenario name:', s.name);
                                if (n) store.rename(s.id, n);
                              }}
                            >
                              ✎
                            </button>
                            <button
                              className="faint px-1 text-[13px] hover:!text-[color:var(--color-coral-500)]"
                              title="Delete"
                              onClick={() => {
                                if (confirm(`Delete scenario “${s.name}”?`)) store.remove(s.id);
                              }}
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Export" subtitle={`Active scenario: ${active.name}`}>
          <div className="flex flex-col gap-3">
            <button className="btn btn-primary justify-center" disabled={busy !== null} onClick={exportExcel}>
              {busy === 'xlsx' ? 'Building workbook…' : 'Download Excel workbook'}
            </button>
            <p className="faint -mt-1 text-[11.5px] leading-snug">
              Nine sheets mirroring the source layout: cover and assumptions, executive summary,
              schedule summary, CAPEX and OPEX line detail, monthly OPEX (M1–M12 × 6 years),
              overhead detail, the JCR, and a comparison sheet when one is selected.
            </p>

            <button className="btn justify-center" disabled={busy !== null} onClick={exportPdf}>
              {busy === 'pdf' ? 'Building report…' : 'Download PDF report'}
            </button>
            <p className="faint -mt-1 text-[11.5px] leading-snug">
              Branded landscape report — headline figures, the year-wise table, charts captured
              from this page, the schedule breakdown, and a full assumptions appendix.
            </p>

            <button className="btn justify-center" onClick={exportJson}>
              Download scenario JSON
            </button>
            <p className="faint -mt-1 text-[11.5px] leading-snug">
              For handing this scenario and your JCR entries to a colleague. The site is static
              with no shared server, so JSON is how work moves between browsers.
            </p>

            <div className="mt-2 border-t pt-3">
              <p className="faint text-[11px] font-semibold uppercase tracking-wider">
                This scenario
              </p>
              <dl className="mt-2 flex flex-col gap-1.5 text-[12.5px]">
                {(
                  [
                    ['GST rate', pct(result.globals.gstRate, 1)],
                    ['Added inflation', pct(result.globals.inflationDelta, 2)],
                    ['CAPEX contingency', pct(result.globals.capexContingency, 1)],
                    ['OPEX contingency', pct(result.globals.opexContingency, 1)],
                    ['Track 2 start', `Year ${result.globals.track2StartYear}`],
                    [
                      'Overhead',
                      result.globals.overheadMode === 'lock50cr'
                        ? 'Locked ₹50 Cr'
                        : 'Bottom-up',
                    ],
                    ['Line overrides', String(result.byItem.filter((i) => i.modified).length)],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="muted">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card
          title="Comparison"
          subtitle={
            compare
              ? `${active.name} against ${compare.name}`
              : 'Pick a scenario with the ⇄ button above to compare it against the active one'
          }
          right={
            compare && (
              <button className="btn" onClick={() => store.setCompare(null)}>
                Clear
              </button>
            )
          }
        >
          {compare && compareResult ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
              <CompareChart
                data={result.byYear.map((y, i) => ({
                  year: y.year,
                  baseline: compareResult.byYear[i].exGst,
                  scenario: y.exGst,
                }))}
                height={300}
              />
              <table className="grid self-start">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th className="r">{active.name}</th>
                    <th className="r">{compare.name}</th>
                    <th className="r">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['CAPEX', result.totals.capex, compareResult.totals.capex],
                      ['OPEX', result.totals.opex, compareResult.totals.opex],
                      ['Overhead', result.totals.overhead, compareResult.totals.overhead],
                      ['Excl. GST', result.totals.exGst, compareResult.totals.exGst],
                      ['GST', result.totals.gst, compareResult.totals.gst],
                      ['Incl. GST', result.totals.inclGst, compareResult.totals.inclGst],
                    ] as [string, number, number][]
                  ).map(([k, a, b]) => (
                    <tr key={k}>
                      <td className="font-medium">{k}</td>
                      <td className="r">{crore(a)}</td>
                      <td className="r muted">{crore(b)}</td>
                      <td
                        className="r font-semibold"
                        style={{
                          color:
                            Math.abs(a - b) < 1
                              ? 'var(--text-faint)'
                              : a > b
                                ? 'var(--color-coral-500)'
                                : 'var(--color-mint-600)',
                        }}
                      >
                        {Math.abs(a - b) < 1 ? '—' : deltaCr(a - b)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No comparison selected.</Empty>
          )}
        </Card>
      </div>

      {/*
        Charts for the PDF. Rendered off-screen so the report always carries them,
        regardless of what happens to be visible on this page. Recharts needs a
        real laid-out box to size itself, so this cannot simply be display:none.
      */}
      <div
        id="pdf-charts"
        aria-hidden
        style={{ position: 'fixed', left: -10000, top: 0, width: 900, pointerEvents: 'none' }}
      >
        <CostOverTime data={result.byYear} height={340} type="bar" />
        <CompareChart
          data={result.byYear.map((y, i) => ({
            year: y.year,
            baseline: (compareResult ?? baseRow.res).byYear[i].exGst,
            scenario: y.exGst,
          }))}
          height={340}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip tone="teal">{store.scenarios.length} scenarios</Chip>
        <Chip>Saved in this browser (localStorage)</Chip>
        <Chip tone="violet">{Object.keys(jcr.entries).length} JCR entries</Chip>
        <Chip tone="amber">{jcr.changeOrders.length} change orders</Chip>
      </div>
    </>
  );
}
