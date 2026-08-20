/** Indian-convention currency and number formatting. */

const CR = 10_000_000; // 1 crore
const LAKH = 100_000;

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Full rupee figure with Indian digit grouping, e.g. "₹3,29,46,10,664". */
export function rupees(n: number, decimals = false): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '−' : '';
  return `${sign}₹${(decimals ? inr2 : inr).format(Math.abs(n))}`;
}

/** Headline format: crore to 2dp, e.g. "₹329.46 Cr". Negatives read "−₹3.23 Cr". */
export function crore(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '−' : '';
  return `${sign}₹${(Math.abs(n) / CR).toFixed(dp)} Cr`;
}

/** Compact: crore above ₹1 Cr, lakh below, rupees below ₹1 lakh. */
export function compact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= CR) return `${sign}₹${(a / CR).toFixed(2)} Cr`;
  if (a >= LAKH) return `${sign}₹${(a / LAKH).toFixed(2)} L`;
  return rupees(n);
}

/** Signed delta in crore, e.g. "+₹12.40 Cr" / "−₹3.10 Cr". */
export function deltaCr(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) < 1) return '—';
  const sign = n > 0 ? '+' : '−';
  return `${sign}₹${(Math.abs(n) / CR).toFixed(dp)} Cr`;
}

export function pct(n: number, dp = 1): string {
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(dp)}%`;
}

export function signedPct(n: number, dp = 1): string {
  if (!Number.isFinite(n) || Math.abs(n) < 1e-9) return '—';
  return `${n > 0 ? '+' : '−'}${(Math.abs(n) * 100).toFixed(dp)}%`;
}

export function num(n: number, dp = 0): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export const toCr = (n: number) => n / CR;
export const fromCr = (n: number) => n * CR;
export { CR };

export function yearLabel(i: number): string {
  return `Year ${i + 1}`;
}

/** Stable id for scenarios and change orders. */
export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Render a number without hiding what it actually is.
 *
 * Many source figures carry decimals — unit rates like 58,739.6252 and OPEX
 * annual values like 82,484,334.333333. Rendering those to 0dp puts a number on
 * screen that is not the number in the model, so an editable field showing
 * "58,740" is misleading before the user has touched anything. This keeps up to
 * `maxDp` decimals and drops trailing zeros, so whole numbers still read clean.
 */
export function preciseNum(n: number, maxDp = 4): string {
  if (!Number.isFinite(n)) return '';
  const rounded = Number(n.toFixed(maxDp));
  const dp = (String(rounded).split('.')[1] ?? '').length;
  return rounded.toLocaleString('en-IN', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

/** Full unrounded value, for tooltips where the exact figure must be available. */
export function exactNum(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return String(n);
}

/**
 * Has an edited value actually moved off its source value? Absolute epsilons
 * misjudge this across a model spanning single rupees to billions, so scale the
 * tolerance to the magnitude being compared.
 */
export function differs(a: number, b: number): boolean {
  return Math.abs(a - b) > Math.max(1e-9, Math.abs(b) * 1e-12);
}
