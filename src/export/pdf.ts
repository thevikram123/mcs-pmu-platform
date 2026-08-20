/**
 * PDF export — a branded scenario report.
 *
 * Charts are rasterised from the live Recharts SVG on the page, so whatever the
 * user is looking at is what lands in the report.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Baseline, Scenario, ScenarioResult } from '../model/types';
import { DEFAULT_GLOBALS } from '../model/engine';

const TEAL: [number, number, number] = [31, 122, 123];
const INK: [number, number, number] = [22, 35, 43];
const MUTED: [number, number, number] = [100, 117, 127];

const cr = (n: number, dp = 2) => `${(n / 1e7).toFixed(dp)}`;
const pctS = (n: number, dp = 1) => `${(n * 100).toFixed(dp)}%`;

/** Rasterise an on-page SVG chart to a PNG data URL. */
export async function svgToPng(svg: SVGSVGElement, scale = 2): Promise<string | null> {
  try {
    const rect = svg.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // Inline a white ground so the chart is legible in the PDF regardless of theme.
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill', '#ffffff');
    clone.insertBefore(bg, clone.firstChild);

    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('svg load failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Grab charts for the report. A page may mount `#pdf-charts` off-screen with the
 * exact charts it wants in the PDF; otherwise whatever is on screen is used.
 */
export async function captureCharts(max = 4): Promise<{ png: string; ratio: number }[]> {
  const scope = document.querySelector('#pdf-charts') ?? document;
  const svgs = [...scope.querySelectorAll<SVGSVGElement>('.recharts-surface')].slice(0, max);
  const out: { png: string; ratio: number }[] = [];
  for (const svg of svgs) {
    const r = svg.getBoundingClientRect();
    const png = await svgToPng(svg);
    if (png) out.push({ png, ratio: r.height / Math.max(1, r.width) });
  }
  return out;
}

export async function buildPdf(
  baseline: Baseline,
  scenario: Scenario,
  result: ScenarioResult,
  charts: { png: string; ratio: number }[] = [],
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const g = result.globals;
  const t = result.totals;

  const header = (title: string, sub?: string) => {
    doc.setFillColor(...TEAL);
    doc.rect(0, 0, W, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold').setFontSize(13);
    doc.text(title, M, 11);
    if (sub) {
      doc.setFont('helvetica', 'normal').setFontSize(9);
      doc.setTextColor(230, 245, 245);
      doc.text(sub, M, 17.5);
    }
    doc.setTextColor(...INK);
  };

  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED);
      doc.text(
        `MCS Phase III Expense Platform  ·  ${scenario.name}  ·  Generated ${new Date().toLocaleString('en-IN')}  ·  All figures Rs. in Crore unless stated`,
        M,
        H - 6,
      );
      doc.text(`${i} / ${pages}`, W - M, H - 6, { align: 'right' });
    }
  };

  /* ------------------------------------------------------------ page 1 */
  header('MCS Phase III — Scenario Report', scenario.name);

  let y = 34;
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...MUTED);
  doc.text('HEADLINE', M, y);
  y += 5;

  const tiles: [string, string][] = [
    ['CAPEX (one-time)', `Rs. ${cr(t.capex)} Cr`],
    ['OPEX (6 years)', `Rs. ${cr(t.opex)} Cr`],
    ['Overhead', `Rs. ${cr(t.overhead)} Cr`],
    ['Total excl. GST', `Rs. ${cr(t.exGst)} Cr`],
    [`GST @ ${pctS(g.gstRate, 0)}`, `Rs. ${cr(t.gst)} Cr`],
    ['Total incl. GST', `Rs. ${cr(t.inclGst)} Cr`],
  ];
  const tw = (W - M * 2 - 5 * 4) / 6;
  tiles.forEach(([label, value], i) => {
    const x = M + i * (tw + 4);
    doc.setDrawColor(226, 232, 236).setFillColor(250, 251, 252);
    doc.roundedRect(x, y, tw, 19, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal').setFontSize(6.8).setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 3, y + 6);
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...INK);
    doc.text(value, x + 3, y + 14);
  });
  y += 27;

  autoTable(doc, {
    startY: y,
    head: [
      [
        'Cost block',
        'Year 1',
        'Year 2',
        'Year 3',
        'Year 4',
        'Year 5',
        'Year 6',
        'Total (6 Yrs)',
      ],
    ],
    body: [
      ['CAPEX', ...result.byYear.map((r) => cr(r.capex)), cr(t.capex)],
      ['OPEX', ...result.byYear.map((r) => cr(r.opex)), cr(t.opex)],
      ['Overhead', ...result.byYear.map((r) => cr(r.overhead)), cr(t.overhead)],
      ['Total excl. GST', ...result.byYear.map((r) => cr(r.exGst)), cr(t.exGst)],
      [`GST @ ${pctS(g.gstRate, 0)}`, ...result.byYear.map((r) => cr(r.gst)), cr(t.gst)],
      ['Total incl. GST', ...result.byYear.map((r) => cr(r.inclGst)), cr(t.inclGst)],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, halign: 'right', textColor: INK },
    headStyles: { fillColor: TEAL, textColor: 255, fontSize: 7.5, halign: 'right' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 42 } },
    didParseCell: (d) => {
      if (d.section === 'body' && (d.row.index === 3 || d.row.index === 5)) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fillColor = [244, 249, 249];
      }
    },
    margin: { left: M, right: M },
  });

  /* ---------------------------------------------------------- charts */
  if (charts.length) {
    doc.addPage();
    header('Charts', scenario.name);
    let cy = 30;
    const cw = (W - M * 2 - 6) / 2;
    charts.slice(0, 4).forEach((c, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ch = Math.min(cw * c.ratio, (H - 40) / 2 - 6);
      const x = M + col * (cw + 6);
      const yy = cy + row * ((H - 40) / 2);
      doc.addImage(c.png, 'PNG', x, yy, cw, ch, undefined, 'FAST');
    });
    cy += 0;
  }

  /* -------------------------------------------------------- schedules */
  doc.addPage();
  header('Schedule breakdown', `${scenario.name} — all figures Rs. in Crore, excl. GST`);
  autoTable(doc, {
    startY: 30,
    head: [
      [
        'Sch',
        'Description',
        'Block',
        'Yr 1',
        'Yr 2',
        'Yr 3',
        'Yr 4',
        'Yr 5',
        'Yr 6',
        'Total',
        'GST',
        'Incl. GST',
        'Tendered',
        'Var.',
      ],
    ],
    body: result.bySchedule.map((s) => [
      s.id,
      s.name.length > 46 ? `${s.name.slice(0, 44)}…` : s.name,
      s.kind.toUpperCase(),
      ...s.years.map((v) => cr(v)),
      cr(s.exGst),
      cr(s.gst),
      cr(s.inclGst),
      cr(s.baselineExGst),
      Math.abs(s.exGst - s.baselineExGst) < 1 ? '—' : cr(s.exGst - s.baselineExGst),
    ]),
    foot: [
      [
        'TOTAL',
        '',
        '',
        ...result.byYear.map((r) => cr(r.exGst)),
        cr(t.exGst),
        cr(t.gst),
        cr(t.inclGst),
        cr(baseline.checksums.projectTotalExGst),
        Math.abs(t.exGst - baseline.checksums.projectTotalExGst) < 1
          ? '—'
          : cr(t.exGst - baseline.checksums.projectTotalExGst),
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.6, halign: 'right', textColor: INK },
    headStyles: { fillColor: TEAL, textColor: 255, fontSize: 6.8, halign: 'right' },
    footStyles: { fillColor: [244, 249, 249], textColor: INK, fontStyle: 'bold', halign: 'right' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 12 },
      1: { halign: 'left', cellWidth: 62 },
      2: { halign: 'left', cellWidth: 16 },
    },
    margin: { left: M, right: M },
  });

  /* ------------------------------------------------------ assumptions */
  doc.addPage();
  header('Assumptions & basis', `${scenario.name} — deviations from the tendered BOQ`);

  const ov = scenario.overrides;
  const modified = result.byItem.filter((i) => i.modified);
  const schedMul = Object.entries(ov.scheduleMul).filter(([, v]) => v !== 1);

  autoTable(doc, {
    startY: 30,
    head: [['Lever', 'This scenario', 'As tendered', 'Changed']],
    body: [
      ['GST rate', pctS(g.gstRate), pctS(DEFAULT_GLOBALS.gstRate), g.gstRate !== 0.18 ? 'Yes' : '—'],
      [
        'Additional inflation p.a.',
        pctS(g.inflationDelta, 2),
        '0.00%',
        g.inflationDelta !== 0 ? 'Yes' : '—',
      ],
      ['CAPEX contingency', pctS(g.capexContingency), '0.0%', g.capexContingency ? 'Yes' : '—'],
      ['OPEX contingency', pctS(g.opexContingency), '0.0%', g.opexContingency ? 'Yes' : '—'],
      [
        'Track 2 start year',
        `Year ${g.track2StartYear}`,
        'Year 2',
        g.track2StartYear !== 2 ? 'Yes' : '—',
      ],
      [
        'Overhead basis',
        g.overheadMode === 'lock50cr' ? 'Locked at Rs.50.00 Cr' : 'Bottom-up (16 lines)',
        'Bottom-up (16 lines)',
        g.overheadMode !== 'bottomUp' ? 'Yes' : '—',
      ],
      [
        'CAPEX recognition',
        g.capexPhasing.map((p) => `${(p * 100).toFixed(0)}%`).join(' / '),
        '100% in Year 1',
        g.capexPhasing[0] !== 1 ? 'Yes' : '—',
      ],
      ['Schedule multipliers', schedMul.length ? `${schedMul.length} applied` : 'None', 'None', schedMul.length ? 'Yes' : '—'],
      [
        'Line-item overrides',
        modified.length ? `${modified.length} lines` : 'None',
        'None',
        modified.length ? 'Yes' : '—',
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2, textColor: INK },
    headStyles: { fillColor: TEAL, textColor: 255, fontSize: 7.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 56 }, 3: { cellWidth: 24 } },
    margin: { left: M, right: M },
  });

  let ay = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (schedMul.length) {
    autoTable(doc, {
      startY: ay,
      head: [['Schedule', 'Multiplier', 'Tendered (Cr)', 'This scenario (Cr)']],
      body: schedMul.map(([id, v]) => {
        const s = result.bySchedule.find((x) => x.id === id)!;
        return [id, `x ${v.toFixed(3)}`, cr(s.baselineExGst), cr(s.exGst)];
      }),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: INK },
      headStyles: { fillColor: [100, 117, 127], textColor: 255, fontSize: 7.5 },
      margin: { left: M, right: M },
    });
    ay = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (modified.length) {
    autoTable(doc, {
      startY: ay,
      head: [['Sch', 'Line item', 'Tendered (Cr)', 'This scenario (Cr)', 'Variance (Cr)']],
      body: modified
        .slice(0, 40)
        .map((i) => [
          i.schedule,
          i.description.length > 70 ? `${i.description.slice(0, 68)}…` : i.description,
          cr(i.baselineExGst),
          cr(i.exGst),
          cr(i.exGst - i.baselineExGst),
        ]),
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.8, halign: 'right', textColor: INK },
      headStyles: { fillColor: [100, 117, 127], textColor: 255, fontSize: 7 },
      columnStyles: {
        0: { halign: 'left', cellWidth: 14 },
        1: { halign: 'left', cellWidth: 110 },
      },
      margin: { left: M, right: M },
    });
    ay = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    if (modified.length > 40) {
      doc.setFont('helvetica', 'italic').setFontSize(7.5).setTextColor(...MUTED);
      doc.text(`… and ${modified.length - 40} further line overrides (see the Excel export).`, M, ay);
      ay += 6;
    }
  }

  // Source notes — these travel with every report so no reader is misled.
  if (ay > H - 46) {
    doc.addPage();
    header('Source notes', scenario.name);
    ay = 32;
  }
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...INK);
  doc.text('Source data quality notes', M, ay);
  ay += 5;
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED);
  for (const n of baseline.dataQuality) {
    const lines = doc.splitTextToSize(
      `${n.severity.toUpperCase()} — ${n.summary} (${n.where}) ${n.detail}`,
      W - M * 2,
    );
    if (ay + lines.length * 3.4 > H - 14) {
      doc.addPage();
      header('Source notes (continued)', scenario.name);
      ay = 32;
    }
    doc.text(lines, M, ay);
    ay += lines.length * 3.4 + 3;
  }

  footer();
  return doc;
}
