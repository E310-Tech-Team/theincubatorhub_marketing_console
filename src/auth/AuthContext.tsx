import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthUser } from '@/api/auth';
import { fetchMe, login as apiLogin, logout as apiLogout } from '@/api/auth';

/**
 * Roles that may use the console. Marketing is for admins and viewers (who see
 * everything and change nothing — the server refuses a viewer's writes).
 */
export type Role = 'admin' | 'agent' | 'viewer';

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  /** Sees every page and download, changes nothing. */
  isViewer: boolean;
  /** admin or viewer — may open the console. */
  canView: boolean;
  /** admin or agent — may access the console (Operations). */
  isStaff: boolean;
  /** True once the initial session check (rehydrate) has resolved. */
  ready: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/*
 * Cached single session check — mirrors legacy-vue/stores/auth.ts `ensureAuthReady`.
 * fetchMe() is fired at most once per page load (the promise is memoised); a 401
 * resolves to `null` (not signed in) rather than throwing. login()/logout() reset
 * the cache so a subsequent call reflects the new session.
 */
let initPromise: Promise<AuthUser | null> | null = null;

export function ensureAuthReady(): Promise<AuthUser | null> {
  if (!initPromise) {
    initPromise = fetchMe()
      .then((user) => user)
      .catch(() => null);
  }
  return initPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    ensureAuthReady().then((resolved) => {
      if (!active) return;
      setUser(resolved);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  async function login(email: string, password: string): Promise<AuthUser> {
    const resolved = await apiLogin(email, password);
    setUser(resolved);
    initPromise = Promise.resolve(resolved);
    setReady(true);
    return resolved;
  }

  async function logout(): Promise<void> {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      initPromise = Promise.resolve(null);
    }
  }

  // A viewer changes nothing: index.css hides every [data-write] control while
  // <html> carries this class. The server refuses a viewer's writes regardless.
  useEffect(() => {
    document.documentElement.classList.toggle('admin-read-only', user?.role === 'viewer');
  }, [user]);

  const value: AuthContextValue = {
    user,
    isAdmin: user?.role === 'admin',
    isViewer: user?.role === 'viewer',
    canView: user?.role === 'admin' || user?.role === 'viewer',
    isStaff: user?.role === 'admin' || user?.role === 'agent',
    ready,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return ctx;
}
