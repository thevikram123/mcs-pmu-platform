/**
 * Milestone timeline — three swimlanes on a shared date axis.
 *
 * A Gantt would be misleading here: most payment milestones are point events,
 * not durations. So each milestone is a dot on its lane, sized by the value it
 * releases and coloured by status, with the year gridlines behind it.
 */

import { useMemo, useState } from 'react';
import type { DerivedMilestone } from '../model/milestones';
import { STATUS_TONE } from '../model/milestones';
import { crore } from '../model/format';

const LANES = ['Common', 'Track 1', 'Track 2'] as const;

function laneOf(track: string): (typeof LANES)[number] {
  if (track.startsWith('Track 1')) return 'Track 1';
  if (track.startsWith('Track 2')) return 'Track 2';
  return 'Common';
}

const day = 86_400_000;
const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export default function Timeline({
  milestones,
  asOf,
  onSelect,
  selected,
}: {
  milestones: DerivedMilestone[];
  asOf: string;
  onSelect?: (id: string) => void;
  selected?: string | null;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const dated = milestones.filter((m) => m.date);
  const { min, span, ticks } = useMemo(() => {
    if (!dated.length) return { min: 0, span: 1, ticks: [] as { x: number; label: string }[] };
    const times = dated.map((m) => Date.parse(`${m.date}T00:00:00Z`));
    const lo = Math.min(...times);
    const hi = Math.max(...times);
    const pad = Math.max(30 * day, (hi - lo) * 0.04);
    const start = lo - pad;
    const total = hi - lo + pad * 2;

    // One tick per year boundary inside the range.
    const t: { x: number; label: string }[] = [];
    const y0 = new Date(start).getUTCFullYear();
    const y1 = new Date(start + total).getUTCFullYear();
    for (let y = y0; y <= y1; y++) {
      const at = Date.UTC(y, 0, 1);
      if (at >= start && at <= start + total) {
        t.push({ x: ((at - start) / total) * 100, label: String(y) });
      }
    }
    return { min: start, span: total, ticks: t };
  }, [dated]);

  if (!dated.length) {
    return <p className="faint py-16 text-center text-[13px]">No milestone has a date yet.</p>;
  }

  const pos = (iso: string) => ((Date.parse(`${iso}T00:00:00Z`) - min) / span) * 100;
  const nowX = pos(asOf);
  const undated = milestones.filter((m) => !m.date);

  // Dot size carries the money: a 4% milestone should read louder than a 0.4%.
  const maxAmt = Math.max(...dated.map((m) => m.amountInclGst ?? 0), 1);
  const radius = (m: DerivedMilestone) => 5 + Math.sqrt((m.amountInclGst ?? 0) / maxAmt) * 11;

  return (
    <div>
      <div className="relative" style={{ paddingTop: 8 }}>
        {/* year gridlines */}
        <div className="pointer-events-none absolute inset-0">
          {ticks.map((t) => (
            <div
              key={t.label}
              className="absolute top-0 bottom-6"
              style={{ left: `${t.x}%`, borderLeft: '1px dashed var(--border)' }}
            >
              <span className="faint absolute -top-1 left-1.5 text-[10px] font-semibold">
                {t.label}
              </span>
            </div>
          ))}
          {nowX >= 0 && nowX <= 100 && (
            <div
              className="absolute top-0 bottom-6"
              style={{ left: `${nowX}%`, borderLeft: '2px solid var(--color-coral-500)' }}
            >
              <span
                className="absolute -top-1 left-1.5 rounded px-1 text-[10px] font-bold text-white"
                style={{ background: 'var(--color-coral-500)' }}
              >
                today
              </span>
            </div>
          )}
        </div>

        {LANES.map((lane) => {
          const items = dated.filter((m) => laneOf(m.track) === lane);
          return (
            <div key={lane} className="relative" style={{ height: 62 }}>
              <div
                className="absolute left-0 right-0"
                style={{ top: 30, height: 2, background: 'var(--border)' }}
              />
              <span
                className="faint absolute left-0 text-[10.5px] font-bold uppercase tracking-wider"
                style={{ top: 38 }}
              >
                {lane}
              </span>
              {items.map((m) => {
                const r = radius(m);
                const on = hover === m.id || selected === m.id;
                return (
                  <button
                    key={m.id}
                    onMouseEnter={() => setHover(m.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onSelect?.(m.id)}
                    className="absolute rounded-full transition-transform"
                    style={{
                      left: `${pos(m.date!)}%`,
                      top: 31 - r,
                      width: r * 2,
                      height: r * 2,
                      marginLeft: -r,
                      background: STATUS_TONE[m.status],
                      border: `2px solid var(--surface)`,
                      transform: on ? 'scale(1.25)' : undefined,
                      zIndex: on ? 5 : 1,
                      boxShadow: on ? '0 3px 10px rgb(0 0 0 / 0.25)' : undefined,
                      cursor: 'pointer',
                    }}
                    title={`${m.id} · ${m.name}`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* hover / selection detail */}
      {(() => {
        const m = milestones.find((x) => x.id === (hover ?? selected));
        if (!m) {
          return (
            <p className="faint mt-3 text-[12px]">
              Hover or click a dot for detail. Dot size is the value released; colour is status.
            </p>
          );
        }
        return (
          <div
            className="mt-3 rounded-[10px] px-4 py-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className="rounded px-1.5 py-0.5 text-[11px] font-bold text-white"
                style={{ background: STATUS_TONE[m.status] }}
              >
                {m.id}
              </span>
              <span className="text-[13px] font-semibold">{m.name}</span>
              <span className="faint text-[12px]">{m.track}</span>
              <span className="tnum ml-auto text-[14px] font-bold">
                {m.amountInclGst ? crore(m.amountInclGst) : 'no payment'}
              </span>
            </div>
            <p className="muted mt-1.5 text-[12px]">
              {m.date ? fmt(m.date) : 'undated'} · {m.timeline}
              {m.times && m.times > 1 && ` · ${m.times} payments`}
              {m.dateModified && (
                <span className="ml-2 font-semibold" style={{ color: 'var(--accent)' }}>
                  date modified
                </span>
              )}
            </p>
            {m.deliverable && (
              <p className="faint mt-1 text-[11.5px] leading-snug">{m.deliverable}</p>
            )}
          </div>
        );
      })()}

      {undated.length > 0 && (
        <p className="faint mt-2 text-[11.5px] leading-snug">
          {undated.length} milestone{undated.length === 1 ? '' : 's'} not shown —{' '}
          {undated.map((m) => m.id).join(', ')} depend on an anchor the MSA never fixes to a date.
          Set a date in the table below to place them.
        </p>
      )}
    </div>
  );
}
