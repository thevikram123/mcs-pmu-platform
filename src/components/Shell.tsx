import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';
import { useScenarios, BASELINE_ID } from '../store/scenarios';
import { countChanges } from '../model/engine';
import { crore } from '../model/format';
import { useResult } from '../model/useModel';

/*
 * Nav is grouped, numbered and ordered as a workflow rather than a flat list of
 * six equal options: see what the budget is, change it, then record what was
 * actually spent.
 *
 * It also collapses to an icon rail. The wide tables on Line Items and the Job
 * Cost Report need the horizontal room on a 1280px laptop, and a fixed 236px
 * sidebar was taking it.
 */
const GROUPS = [
  {
    label: '1 · What the budget is',
    short: '1',
    items: [
      { to: '/', label: 'Home', icon: '⌂', end: true },
      { to: '/overview', label: 'Cost Breakdown', icon: '▤' },
      { to: '/explorer', label: 'Line Items', icon: '⛁' },
    ],
  },
  {
    label: '2 · What if it changes',
    short: '2',
    items: [
      { to: '/simulator', label: 'What-If Simulator', icon: '⚙' },
      { to: '/scenarios', label: 'Scenarios & Export', icon: '⎘' },
    ],
  },
  {
    label: '3 · What was spent',
    short: '3',
    items: [{ to: '/jcr', label: 'Job Cost Report', icon: '✓' }],
  },
];

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('mcs.theme') ?? 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('mcs.theme', theme);
  }, [theme]);
  return [theme, setTheme] as const;
}

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mcs.nav') === 'collapsed');
  useEffect(() => {
    localStorage.setItem('mcs.nav', collapsed ? 'collapsed' : 'open');
  }, [collapsed]);
  return [collapsed, setCollapsed] as const;
}

export default function Shell() {
  const logout = useAuth((s) => s.logout);
  const user = useAuth((s) => s.user);
  const nav = useNavigate();
  const [theme, setTheme] = useTheme();
  const [collapsed, setCollapsed] = useCollapsed();
  const result = useResult();

  const scenarios = useScenarios((s) => s.scenarios);
  const activeId = useScenarios((s) => s.activeId);
  const setActive = useScenarios((s) => s.setActive);
  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0];
  const changes = countChanges(active.overrides);
  const isBaseline = activeId === BASELINE_ID;

  return (
    <div className="flex h-full">
      <aside
        className="no-print flex shrink-0 flex-col py-5 transition-[width] duration-150"
        style={{
          // A flex item defaults to min-width:auto, so it refuses to shrink below
          // its content width — width alone would be ignored here. Pin all three.
          width: collapsed ? 68 : 236,
          minWidth: collapsed ? 68 : 236,
          maxWidth: collapsed ? 68 : 236,
          paddingInline: collapsed ? 8 : 16,
          background: 'var(--bg)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* ------------------------------------------------------ brand row */}
        <div
          className={`mb-6 flex items-center gap-2.5 ${collapsed ? 'justify-center' : 'px-2'}`}
        >
          <div
            className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[15px] font-black text-white"
            style={{ background: 'var(--accent)' }}
            title="MCS PMU — Expense Platform"
          >
            M
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[14px] font-bold">MCS PMU</p>
              <p className="faint truncate text-[11px]">Expense Platform</p>
            </div>
          )}
        </div>

        <nav className="flex flex-col gap-5">
          {GROUPS.map((g) => (
            <div key={g.label}>
              {collapsed ? (
                <p className="faint mb-1.5 text-center text-[10px] font-bold">{g.short}</p>
              ) : (
                <p className="faint mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.11em]">
                  {g.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {g.items.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.end} title={collapsed ? n.label : undefined}>
                    {({ isActive }) => (
                      <span
                        className="navpill"
                        data-active={isActive}
                        style={collapsed ? { justifyContent: 'center', padding: '9px 0' } : undefined}
                      >
                        <span className="w-4 text-center text-[14px] opacity-70">{n.icon}</span>
                        {!collapsed && n.label}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 pt-6">
          {/* Running total, so the headline figure never scrolls away. */}
          {collapsed ? (
            <div
              className="card px-1 py-2 text-center"
              title={`${active.name} — total excl. GST`}
            >
              <p className="faint text-[9px] font-bold uppercase">Total</p>
              <p className="tnum text-[11px] font-bold leading-tight">
                {crore(result.totals.exGst, 0)}
              </p>
            </div>
          ) : (
            <div className="card p-3">
              <p className="faint mb-1.5 text-[10px] font-bold uppercase tracking-[0.11em]">
                Working scenario
              </p>
              <select
                className="inp !py-1.5 !text-[12.5px]"
                value={activeId}
                onChange={(e) => setActive(e.target.value)}
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="faint mt-1.5 text-[11px]">
                {isBaseline
                  ? 'As tendered — unmodified'
                  : `${changes} change${changes === 1 ? '' : 's'}`}
              </p>
              <div className="mt-2.5 border-t pt-2.5">
                <p className="faint text-[10px] font-bold uppercase tracking-[0.11em]">
                  Total excl. GST
                </p>
                <p className="tnum mt-0.5 whitespace-nowrap text-[17px] font-bold">
                  {crore(result.totals.exGst)}
                </p>
              </div>
            </div>
          )}

          <button
            className="navpill !justify-center"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="text-[13px]">{collapsed ? '»' : '«'}</span>
            {!collapsed && <span className="text-[12px]">Collapse</span>}
          </button>

          {!collapsed && (
            <div className="flex items-center justify-between px-1">
              <button
                className="faint text-[12px] hover:underline"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? '☀ Light' : '☾ Dark'}
              </button>
              <button
                className="faint text-[12px] hover:underline"
                onClick={() => {
                  logout();
                  nav('/login');
                }}
                title={`Signed in as ${user}`}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
        <Outlet />
      </main>
    </div>
  );
}
