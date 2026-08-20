/**
 * Single-user login gate.
 *
 * IMPORTANT — this is presentational, not access control. GitHub Pages serves
 * static files with no server, so the check runs entirely in the visitor's
 * browser and anyone can bypass it with devtools. The repository is public, so
 * the code and the baked-in BOQ figures are readable regardless. This gate keeps
 * casual visitors out of the dashboard; it does not protect the data. See README.
 */

import { create } from 'zustand';

export const USERNAME = 'AjayRamteke';

/** SHA-256 digest of the account password. */
const PASSWORD_SHA256 = 'ac281ae4adc49fcec864640edcadba69cd6924eb8206e772eec136e992b934b6';

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SESSION_KEY = 'mcs.session';

interface AuthState {
  user: string | null;
  error: string | null;
  busy: boolean;
  login: (user: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: sessionStorage.getItem(SESSION_KEY),
  error: null,
  busy: false,

  async login(user, password) {
    set({ busy: true, error: null });
    const digest = await sha256Hex(password);
    const ok = user.trim().toLowerCase() === USERNAME.toLowerCase() && digest === PASSWORD_SHA256;
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, USERNAME);
      set({ user: USERNAME, busy: false, error: null });
    } else {
      set({ busy: false, error: 'Incorrect user ID or password.' });
    }
    return ok;
  },

  logout() {
    sessionStorage.removeItem(SESSION_KEY);
    set({ user: null, error: null });
  },
}));
