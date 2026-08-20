import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';
import { useScenarios, BASELINE_ID } from '../store/scenarios';
import { countChanges } from '../model/engine';

const NAV = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/overview', label: 'Overview', icon: '▤' },
  { to: '/explorer', label: 'Cost Explorer', icon: '⛁' },
  { to: '/simulator', label: 'Simulator', icon: '⚙' },
  { to: '/jcr', label: 'Job Cost Report', icon: '✓' },
  { to: '/scenarios', label: 'Scenarios', icon: '⎘' },
];

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('mcs.theme') ?? 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('mcs.theme', theme);
  }, [theme]);
  return [theme, setTheme] as const;
}

export default function Shell() {
  const logout = useAuth((s) => s.logout);
  const user = useAuth((s) => s.user);
  const nav = useNavigate();
  const [theme, setTheme] = useTheme();

  const scenarios = useScenarios((s) => s.scenarios);
  const activeId = useScenarios((s) => s.activeId);
  const setActive = useScenarios((s) => s.setActive);
  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0];
  const changes = countChanges(active.overrides);

  return (
    <div className="flex h-full">
      <aside
        className="no-print flex w-[228px] shrink-0 flex-col gap-1 px-4 py-5"
        style={{ background: 'var(--bg)', borderRight: '1px solid var(--border)' }}
      >
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div
            className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[15px] font-black text-white"
            style={{ background: 'var(--accent)' }}
          >
            M
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[14px] font-bold">MCS PMU</p>
            <p className="faint truncate text-[11px]">Expense Platform</p>
          </div>
        </div>

        <p className="faint mb-1 px-2 text-[10.5px] font-bold uppercase tracking-widest">
          Cost Control
        </p>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {({ isActive }) => (
                <span className="navpill" data-active={isActive}>
                  <span className="w-4 text-center text-[14px] opacity-70">{n.icon}</span>
                  {n.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 pt-6">
          <div className="card p-3">
            <p className="faint mb-1.5 text-[10.5px] font-bold uppercase tracking-widest">
              Active scenario
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
              {activeId === BASELINE_ID
                ? 'As tendered — unmodified'
                : `${changes} change${changes === 1 ? '' : 's'} vs baseline`}
            </p>
          </div>

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
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
        <Outlet />
      </main>
    </div>
  );
}
