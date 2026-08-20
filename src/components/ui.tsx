import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { crore, rupees, signedPct } from '../model/format';

/* ------------------------------------------------------------------ layout */

export function Card({
  title,
  subtitle,
  right,
  children,
  className = '',
  bodyClass = 'p-5',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`card flex flex-col ${className}`}>
      {(title || right) && (
        <header className="card-head flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>}
            {subtitle && <p className="muted mt-0.5 text-[12.5px] leading-snug">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className={`${bodyClass} min-h-0 flex-1`}>{children}</div>
    </section>
  );
}

export function Banner({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="banner mb-5 flex items-center justify-between gap-6 px-7 py-6">
      <div className="relative z-10 min-w-0">
        <h1 className="text-[19px] font-bold uppercase tracking-wide text-white">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13.5px] text-white/80">{subtitle}</p>}
      </div>
      {right && <div className="relative z-10 shrink-0">{right}</div>}
    </div>
  );
}

/* --------------------------------------------------------------- KPI tiles */

const TONES = {
  teal: { bg: 'var(--color-teal-600)', soft: 'var(--color-teal-100)' },
  mint: { bg: 'var(--color-mint-500)', soft: '#d1fae5' },
  coral: { bg: 'var(--color-coral-500)', soft: '#ffe4e6' },
  amber: { bg: 'var(--color-amber-450)', soft: '#fef3c7' },
  violet: { bg: 'var(--color-violet-450)', soft: '#ede9fe' },
  slate: { bg: '#64748b', soft: '#e2e8f0' },
} as const;

export type Tone = keyof typeof TONES;

export function KpiTile({
  label,
  value,
  sub,
  icon,
  tone = 'teal',
  delta,
  title,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  icon: ReactNode;
  tone?: Tone;
  delta?: number;
  title?: string;
}) {
  return (
    <div className="card flex items-center gap-4 p-4" title={title}>
      <div
        className="grid size-12 shrink-0 place-items-center rounded-xl text-white"
        style={{ background: TONES[tone].bg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="faint truncate text-[11px] font-semibold uppercase tracking-wider">
          {label}
        </p>
        <p className="tnum mt-0.5 truncate text-[19px] font-bold leading-tight">{value}</p>
        {(sub || delta !== undefined) && (
          <p className="muted mt-0.5 truncate text-[12px]">
            {delta !== undefined && (
              <span
                className="font-semibold"
                style={{
                  color:
                    Math.abs(delta) < 1e-9
                      ? 'var(--text-muted)'
                      : delta > 0
                        ? 'var(--color-coral-500)'
                        : 'var(--color-mint-600)',
                }}
              >
                {signedPct(delta)}{' '}
              </span>
            )}
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

/** Currency shown in crore, with the exact rupee figure on hover. */
export function Money({ value, dp = 2, className = '' }: { value: number; dp?: number; className?: string }) {
  return (
    <span className={`tnum ${className}`} title={rupees(value, true)}>
      {crore(value, dp)}
    </span>
  );
}

/* ------------------------------------------------------------ slider input */

/**
 * A slider paired with a typed numeric box, plus a reset to the source value.
 * Every cost lever in the platform uses this so the two input styles the brief
 * asked for are always available together.
 */
export function SliderInput({
  label,
  hint,
  value,
  baseline,
  min,
  max,
  step,
  onChange,
  onReset,
  format = (v) => v.toFixed(2),
  parse = (s) => Number(s),
  suffix,
  disabled,
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: number;
  baseline: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onReset: () => void;
  format?: (v: number) => string;
  parse?: (s: string) => number;
  suffix?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const dirty = Math.abs(value - baseline) > 1e-9;
  const shown = draft ?? format(value);

  const commit = (s: string) => {
    if (draft === null) return setDraft(null); // untouched: keep full precision
    const n = parse(s);
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    setDraft(null);
  };

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className="text-[12.5px] font-medium">{label}</label>
        <div className="flex items-center gap-1.5">
          <input
            className="inp !w-[86px] !py-1 text-right"
            value={shown}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setDraft(null);
            }}
          />
          {suffix && <span className="faint w-4 text-[12px]">{suffix}</span>}
          <button
            className="faint hover:!text-[color:var(--accent)] px-1 text-[15px] leading-none disabled:opacity-25"
            title={`Reset to source value (${format(baseline)}${suffix ?? ''})`}
            disabled={!dirty || disabled}
            onClick={onReset}
          >
            ⟲
          </button>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p className="faint mt-1 text-[11.5px] leading-snug">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------- editable cell */

export function NumberCell({
  value,
  baseline,
  onChange,
  format = (v) => (v ? v.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'),
  align = 'right',
  width = 'w-32',
  disabled,
}: {
  value: number;
  baseline?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  align?: 'right' | 'left';
  width?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const dirty = baseline !== undefined && Math.abs(value - baseline) > 0.5;
  return (
    <input
      className={`inp ${width} !py-1 ${align === 'right' ? 'text-right' : ''}`}
      style={
        dirty
          ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 }
          : undefined
      }
      disabled={disabled}
      value={draft ?? format(value)}
      title={baseline !== undefined ? `Source value: ${format(baseline)}` : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        // Only commit when the user actually typed. The display is rounded, so
        // a focus-and-tab-out would otherwise silently overwrite a precise
        // source rate (e.g. 58,739.6252) with its rounded form.
        if (draft !== null) {
          const n = Number(e.target.value.replace(/[,\s₹]/g, ''));
          if (Number.isFinite(n)) onChange(n);
        }
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}

/* -------------------------------------------------------------- misc bits */

export function Chip({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className="chip"
      style={
        tone
          ? { background: TONES[tone].soft, color: TONES[tone].bg, borderColor: 'transparent' }
          : undefined
      }
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="faint px-2 py-10 text-center text-[13px]">{children}</p>;
}

export function Toggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg p-0.5"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition"
          style={
            value === o.value
              ? { background: 'var(--accent)', color: '#fff' }
              : { color: 'var(--text-muted)' }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Dismissible detail panel used for the source data-quality notes. */
export function Disclosure({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open]);
  return (
    <div ref={ref}>
      <button
        className="flex w-full items-center gap-2 text-left text-[13px] font-medium"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="faint text-[10px]">{open ? '▼' : '▶'}</span>
        {summary}
      </button>
      {open && <div className="muted mt-2 pl-4 text-[12.5px] leading-relaxed">{children}</div>}
    </div>
  );
}
