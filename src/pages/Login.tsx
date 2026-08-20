import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { baseline } from '../model/useModel';

export default function Login() {
  const { user, login, error, busy } = useAuth();
  const nav = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await login(id, pw)) nav('/', { replace: true });
  }

  return (
    <div className="flex h-full">
      {/* Brand panel */}
      <div className="banner relative hidden flex-1 flex-col justify-between !rounded-none p-12 lg:flex">
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-white/15 text-lg font-black text-white backdrop-blur">
            M
          </div>
          <div className="leading-tight text-white">
            <p className="text-[16px] font-bold">MCS PMU</p>
            <p className="text-[12px] text-white/70">Expense Platform</p>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-[34px] font-bold leading-[1.15] text-white">
            Mumbai City Surveillance
            <span className="block text-white/70">Phase III cost model</span>
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-white/75">
            The full six-year CAPEX, OPEX and overhead model from the tendered BOQ — every cost
            driver adjustable, every scenario exportable to Excel and PDF.
          </p>
          <dl className="mt-9 grid grid-cols-3 gap-6 border-t border-white/20 pt-6">
            {[
              ['Cost line items', '394'],
              ['Schedules', '20'],
              ['Horizon', '6 years'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] uppercase tracking-widest text-white/50">{k}</dt>
                <dd className="mt-1 text-[21px] font-bold text-white">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative z-10 text-[11.5px] text-white/45">
          {baseline.projectFacts['Tender Ref'] ?? 'Mumbai City Surveillance Project'}
        </p>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-6 lg:w-[480px] lg:shrink-0">
        <form onSubmit={submit} className="w-full max-w-[340px]">
          <h2 className="text-[22px] font-bold">Sign in</h2>
          <p className="muted mt-1 text-[13px]">Enter your PMU credentials to continue.</p>

          <label className="mt-7 block text-[12.5px] font-medium">User ID</label>
          <input
            className="inp mt-1.5 !py-2.5"
            value={id}
            onChange={(e) => setId(e.target.value)}
            autoComplete="username"
            autoFocus
            placeholder="AjayRamteke"
          />

          <label className="mt-4 block text-[12.5px] font-medium">Password</label>
          <input
            className="inp mt-1.5 !py-2.5"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••••"
          />

          {error && (
            <p
              className="mt-3 rounded-lg px-3 py-2 text-[12.5px] font-medium"
              style={{ background: '#fee2e2', color: '#b91c1c' }}
            >
              {error}
            </p>
          )}

          <button
            className="btn btn-primary mt-6 w-full justify-center !py-2.5"
            disabled={busy || !id || !pw}
          >
            {busy ? 'Checking…' : 'Sign in'}
          </button>

          <p className="faint mt-8 text-[11.5px] leading-relaxed">
            This sign-in runs in your browser only. The site is served as static files with no
            server behind it, so treat it as a courtesy gate rather than access control — the cost
            data it displays is not protected by this password.
          </p>
        </form>
      </div>
    </div>
  );
}
