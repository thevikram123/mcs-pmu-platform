/**
 * Guards against the fragment bug.
 *
 * Recharts collects its children by inspecting element types and does NOT
 * traverse into React fragments. Wrapping series in one — `<><Bar/><Bar/></>` —
 * silently renders an empty plot: grid and X axis appear, but no bars, and no
 * Y axis either because nothing supplies a numeric domain. It looks like a
 * styling problem, not a broken chart, so it is easy to ship by accident.
 *
 * This asserts structurally that no chart puts its series inside a fragment.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, 'charts.tsx'), 'utf8');

/** Strip block and line comments so prose about the bug is not matched. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const SERIES_TAGS = ['Bar', 'Area', 'Line', 'Pie'];

describe('chart composition', () => {
  const body = code(source);

  it('never wraps chart series in a fragment', () => {
    // Find each fragment and check it contains no series element.
    const fragments = body.match(/<>[\s\S]*?<\/>/g) ?? [];
    for (const frag of fragments) {
      for (const tag of SERIES_TAGS) {
        expect(
          new RegExp(`<${tag}[\\s/>]`).test(frag),
          `<${tag}> is inside a fragment — Recharts will not see it and the plot will render empty`,
        ).toBe(false);
      }
    }
  });

  it('renders every series with animation disabled', () => {
    // Live sliders must move the chart on the same frame, not replay a tween.
    const opens = body.match(/<(Bar|Area|Line|Pie)\b[\s\S]*?>/g) ?? [];
    const series = opens.filter((t) => !t.startsWith('</'));
    expect(series.length).toBeGreaterThan(0);
    for (const tag of series) {
      expect(tag.includes('isAnimationActive={false}'), `missing on: ${tag.slice(0, 60)}`).toBe(
        true,
      );
    }
  });

  it('exports the memoised chart components', () => {
    for (const name of ['CostOverTime', 'CompareChart', 'RankBar', 'Donut', 'Waterfall']) {
      expect(body).toContain(`export const ${name} = memo(${name}Impl)`);
    }
  });

  it('gives CostOverTime a real Y axis in both modes', () => {
    // Two chart returns, one per mode; each must carry its own axes.
    const impl = body.slice(body.indexOf('function CostOverTimeImpl'), body.indexOf('function CompareChartImpl'));
    expect((impl.match(/<YAxis/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((impl.match(/<XAxis/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
