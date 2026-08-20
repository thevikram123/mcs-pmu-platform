/**
 * Per-page operating instructions.
 *
 * Every screen states in plain language what it is for and what to actually do
 * on it, so someone opening the tool for the first time is never guessing.
 * Collapsible, and the choice is remembered — regular users can fold it away
 * without it disappearing for the next person on a fresh machine.
 */

import { useEffect, useState, type ReactNode } from 'react';

const KEY = 'mcs.howto.collapsed';

function useCollapsed(id: string) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return (JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, boolean>)[id] ?? false;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, boolean>;
      all[id] = collapsed;
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* storage unavailable — the panel simply won't remember */
    }
  }, [id, collapsed]);
  return [collapsed, setCollapsed] as const;
}

export interface HowToStep {
  /** The action, e.g. "Drag any slider". Rendered emphasised. */
  do: string;
  /** What happens as a result. */
  then: string;
}

export default function HowTo({
  id,
  purpose,
  steps,
  note,
}: {
  id: string;
  purpose: string;
  steps: HowToStep[];
  note?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useCollapsed(id);

  return (
    <section
      className="mb-5 rounded-[14px] px-5 py-4"
      style={{
        background: 'var(--accent-soft)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--accent)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="grid size-[18px] shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
              style={{ background: 'var(--accent)' }}
            >
              ?
            </span>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.08em]">How to use this page</h2>
          </div>
          <p className="mt-1.5 text-[13px] font-medium leading-snug">{purpose}</p>
        </div>
        <button
          className="faint shrink-0 text-[12px] font-semibold hover:underline"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? 'Show steps' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <>
          <ol className="mt-3.5 grid grid-cols-1 gap-x-8 gap-y-2.5 md:grid-cols-2 xl:grid-cols-3">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className="mt-[1px] grid size-[19px] shrink-0 place-items-center rounded-full text-[11px] font-bold"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {i + 1}
                </span>
                <p className="text-[12.5px] leading-snug">
                  <strong className="font-semibold">{s.do}</strong>
                  <span className="muted"> — {s.then}</span>
                </p>
              </li>
            ))}
          </ol>
          {note && <p className="faint mt-3 text-[11.5px] leading-relaxed">{note}</p>}
        </>
      )}
    </section>
  );
}
