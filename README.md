# MCS PMU — Expense Platform

Six-year expense model, scenario simulator and job cost report for the **Mumbai City
Surveillance (MCS) Phase III** project.

**Live:** https://thevikram123.github.io/mcs-pmu-platform/

---

## ⚠️ The login is not access control

This site is static files on GitHub Pages. There is no server, so the sign-in check runs
entirely in the visitor's browser and **anyone can bypass it** with developer tools. The
repository is public, so the source and the baked-in BOQ figures are readable by anyone who
finds it, password or not.

The gate exists to keep casual visitors out of the dashboard. **Do not treat it as protection
for confidential data.** If these figures ever need real protection, the app has to move to a
host with server-side auth (Cloudflare Pages + Access, Netlify Identity, Vercel) — the code
would carry over unchanged.

---

## What it does

Three disconnected workbooks became one live model. Every year-wise figure in the source is a
hardcoded number typed in from the BOQ — of ~1,241 year cells in the 6-year report, only 72 are
formulas (the schedule subtotals). There was no way to ask "what if GST changes" without
hand-editing hundreds of cells. Now every cost driver is a slider and a typed input.

| Page | What it's for |
| --- | --- |
| **Home** | Project facts, headline KPIs, six-year profile |
| **Overview** | Cost over time, track split, concentration by OEM/category/phase, TCV reconciliation, source data-quality notes |
| **Cost Explorer** | Drill schedule → line item across 394 priced lines; edit any quantity, rate or annual value |
| **Simulator** | Global levers and per-schedule multipliers, with the movement attributed lever by lever, plus a sensitivity ranking |
| **Job Cost Report** | Committed / actual / % complete per cost code, EFC and variance, change-order log |
| **Scenarios** | Save, compare, and export to Excel / PDF / JSON |

### Sources

| Block | Ex-GST | From |
| --- | ---: | --- |
| CAPEX — Schedules A–G, 161 lines, 33 OEMs | ₹329.46 Cr | `MCS_Job_Cost_Report_6Year.xlsx` |
| OPEX — Schedules H1–O2, 217 lines | ₹691.77 Cr | `MCS_Job_Cost_Report_6Year.xlsx` |
| Overhead — Schedule P, 16 lines | ₹53.23 Cr | `Overhead Cost.xlsx` |
| **Total** | **₹1,074.46 Cr** | |
| GST @ 18% | ₹193.40 Cr | |
| Contract value (TCV, incl. GST) | ₹2,098.92 Cr | `MCS_Phase3_JCR_Tracker.xlsx` |

The source workbooks live outside this repo and are never modified. `tools/extract_baseline.py`
reads them into `src/data/baseline.json` and refuses to write if any total drifts.

---

## Design decisions worth knowing

**Inflation is a delta, not a re-derivation.** OPEX year figures follow four different patterns in
the source: flat repeat (H1, I1, K, M, N); Track-2 zero-in-Year-1 (H2, I2, J2, O2); a Year 1→2
warranty step-down in J1; and compounded escalation (L at 5.0%, O1/O2 at 4.0% staff / 6.0%
drivers). Back-solving a single rate would destroy the step and the irregularities, so the
inflation slider compounds *on top of* the given values. **At 0% the tendered numbers survive
untouched** — that is asserted by a test, not assumed.

**Overhead has two bases.** The bottom-up 16-line build-up from `Overhead Cost.xlsx` comes to
₹53.23 Cr; the Phase III JCR tracker carries Schedule P as a flat ₹50 Cr. Both are available: the
lock rescales the block to exactly ₹50.00 Cr while preserving each line's relative weight, so
sliders then change the mix rather than the total.

**Track 2 timing truncates.** Slipping Track 2 past Year 2 pushes spend beyond the six-year
horizon, where it drops out — so a slip *lowers* the six-year total. That is intended and stated
in the UI.

**CAPEX sits in Year 1.** The source BOQ gives no year-wise CAPEX split; the Executive Summary
places it all in Year 1 for cash-flow presentation. The simulator can spread it; the total never
changes.

### Two defects found in the source, carried not corrected

1. **`OPEX Summary`!CF/CG are shifted one column.** CF is headed "GST @ 18%" but links to the
   ex-GST total; CG is headed "Incl. GST" but links to the GST amount. CF19 reads
   ₹6,917,661,679.69 where ₹1,245,179,102.34 is meant. The Executive Summary is unaffected
   (it computes `F7*18%` itself). **This platform computes GST correctly, and its Excel export is
   right where the source is wrong.**
2. **`OPEX BOQ - Detail`!L279** — Schedule O1 "Manpower in Mobile Vans" reads 3,959,612 in Year 3,
   breaking a clean 4% escalation; its Track-2 twin at row 286 reads 5,869,696 (= 5,643,938 ×
   1.04). Appears to understate by ~₹19.1 lakh. A decision for the BOQ owner.

Both are surfaced in the app's Data Quality panel and in every export.

---

## Development

```bash
npm install
npm test          # fidelity suite — must stay green
npm run dev
npm run build
```

Re-extract the baseline after any change to the source workbooks:

```bash
python tools/extract_baseline.py
```

`npm test` is the gate that matters. It asserts the engine reproduces CAPEX, OPEX, overhead, the
project total and the OPEX year-wise split to within ₹1 of the workbooks, that the ₹50 Cr lock
lands exactly, that every schedule subtotal equals the sum of its own line items with no gap or
double-count, and that each lever behaves as documented. CI blocks the deploy on failure.

**Stack:** Vite · React 19 · TypeScript · Tailwind 4 · Recharts · Zustand · SheetJS · jsPDF.
Everything is bundled — no runtime CDN dependencies. `HashRouter` is used because GitHub Pages
has no rewrite rules and path routing would 404 on refresh.

`xlsx` resolves to the official SheetJS CDN tarball rather than the npm-registry build, which
carries unfixed advisories; `npm ci` therefore needs to reach `cdn.sheetjs.com`.

## Data lives in your browser

Scenarios, JCR entries and change orders are held in `localStorage`. There is no shared server,
so use **Scenarios → Download scenario JSON** to move work between browsers or hand it to a
colleague; the matching **Import JSON** button loads it back.
