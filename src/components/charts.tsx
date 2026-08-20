import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from 'recharts';
import { crore, rupees, toCr } from '../model/format';

export const SERIES = {
  capex: '#1f7a7b',
  opex: '#43b0b0',
  overhead: '#8b5cf6',
  gst: '#f59e0b',
  baseline: '#94a3b8',
  scenario: '#1f7a7b',
  up: '#f43f5e',
  down: '#10b981',
};

export const PALETTE = [
  '#1f7a7b',
  '#43b0b0',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#f43f5e',
  '#0ea5e9',
  '#a3a3a3',
  '#84cc16',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
];

const axis = {
  stroke: 'var(--text-faint)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />;

function TipBox({
  active,
  payload,
  label,
  total,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string;
  total?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const sum = payload.reduce((a, p) => a + (p.value ?? 0), 0);
  return (
    <div className="card px-3 py-2 text-[12px]" style={{ borderRadius: 10 }}>
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="muted">{p.name}</span>
          </span>
          <span className="tnum font-semibold" title={rupees((p.value ?? 0) * 1e7, true)}>
            {crore((p.value ?? 0) * 1e7)}
          </span>
        </div>
      ))}
      {total && payload.length > 1 && (
        <div className="mt-1 flex items-center justify-between gap-5 border-t pt-1 font-semibold">
          <span>Total</span>
          <span className="tnum">{crore(sum * 1e7)}</span>
        </div>
      )}
    </div>
  );
}

const crTick = (v: number) => `₹${v.toFixed(0)}`;

/** Stacked CAPEX / OPEX / Overhead across the six-year horizon. */
export function CostOverTime({
  data,
  height = 300,
  type = 'area',
}: {
  data: { year: number; capex: number; opex: number; overhead: number }[];
  height?: number;
  type?: 'area' | 'bar';
}) {
  const rows = data.map((d) => ({
    name: `Yr ${d.year}`,
    CAPEX: toCr(d.capex),
    OPEX: toCr(d.opex),
    Overhead: toCr(d.overhead),
  }));
  const Chart = type === 'area' ? AreaChart : BarChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          {(['capex', 'opex', 'overhead'] as const).map((k) => (
            <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES[k]} stopOpacity={0.75} />
              <stop offset="100%" stopColor={SERIES[k]} stopOpacity={0.12} />
            </linearGradient>
          ))}
        </defs>
        {grid}
        <XAxis dataKey="name" {...axis} />
        <YAxis {...axis} tickFormatter={crTick} width={52} />
        <Tooltip content={<TipBox total />} cursor={{ fill: 'var(--surface-2)' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
        {type === 'area' ? (
          <>
            <Area dataKey="CAPEX" stackId="1" stroke={SERIES.capex} fill="url(#g-capex)" />
            <Area dataKey="OPEX" stackId="1" stroke={SERIES.opex} fill="url(#g-opex)" />
            <Area
              dataKey="Overhead"
              stackId="1"
              stroke={SERIES.overhead}
              fill="url(#g-overhead)"
            />
          </>
        ) : (
          <>
            <Bar dataKey="CAPEX" stackId="1" fill={SERIES.capex} radius={[0, 0, 0, 0]} />
            <Bar dataKey="OPEX" stackId="1" fill={SERIES.opex} />
            <Bar dataKey="Overhead" stackId="1" fill={SERIES.overhead} radius={[5, 5, 0, 0]} />
          </>
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

/** Scenario against baseline, year by year. */
export function CompareChart({
  data,
  height = 300,
}: {
  data: { year: number; baseline: number; scenario: number }[];
  height?: number;
}) {
  const rows = data.map((d) => ({
    name: `Yr ${d.year}`,
    Baseline: toCr(d.baseline),
    Scenario: toCr(d.scenario),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        {grid}
        <XAxis dataKey="name" {...axis} />
        <YAxis {...axis} tickFormatter={crTick} width={52} />
        <Tooltip content={<TipBox />} cursor={{ fill: 'var(--surface-2)' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
        <Bar dataKey="Baseline" fill={SERIES.baseline} radius={[5, 5, 0, 0]} maxBarSize={38} />
        <Line
          dataKey="Scenario"
          stroke={SERIES.scenario}
          strokeWidth={2.5}
          dot={{ r: 3.5, fill: SERIES.scenario }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Horizontal ranking bar — schedules, OEMs, categories. */
export function RankBar({
  data,
  height = 300,
  color,
}: {
  data: { key: string; exGst: number }[];
  height?: number;
  color?: (k: string, i: number) => string;
}) {
  const rows = data.map((d) => ({ name: d.key, Value: toCr(d.exGst) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" {...axis} tickFormatter={crTick} />
        <YAxis type="category" dataKey="name" {...axis} width={150} interval={0} />
        <Tooltip content={<TipBox />} cursor={{ fill: 'var(--surface-2)' }} />
        <Bar dataKey="Value" radius={[0, 5, 5, 0]} maxBarSize={20}>
          {rows.map((r, i) => (
            <Cell key={r.name} fill={color?.(r.name, i) ?? PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({
  data,
  height = 260,
  colors = PALETTE,
}: {
  data: { key: string; exGst: number }[];
  height?: number;
  colors?: string[];
}) {
  const rows = data.map((d) => ({ name: d.key, value: toCr(d.exGst) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="value"
          nameKey="name"
          innerRadius="56%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="var(--surface)"
          strokeWidth={2}
        >
          {rows.map((r, i) => (
            <Cell key={r.name} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip content={<TipBox />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Contribution of each lever to the change from baseline. */
export function Waterfall({
  data,
  height = 280,
}: {
  data: { name: string; delta: number }[];
  height?: number;
}) {
  const rows = data.map((d) => ({ name: d.name, Delta: toCr(d.delta) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        {grid}
        <XAxis dataKey="name" {...axis} interval={0} angle={-18} textAnchor="end" height={58} />
        <YAxis {...axis} tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}`} width={52} />
        <Tooltip content={<TipBox />} cursor={{ fill: 'var(--surface-2)' }} />
        <ReferenceLine y={0} stroke="var(--text-faint)" />
        <Bar dataKey="Delta" radius={[4, 4, 0, 0]} maxBarSize={44}>
          {rows.map((r) => (
            <Cell key={r.name} fill={r.Delta >= 0 ? SERIES.up : SERIES.down} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
