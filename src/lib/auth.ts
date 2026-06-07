import { supabase, isSupabaseConfigured } from './supabase';

export type UserRole = 'admin' | 'staff';

export interface CRMUser {
  email: string;
  name: string;
  role: UserRole;
}

// ---------------------------------------------------------------------------
// Sync helpers — read the cached role set during login
// These are safe to call synchronously; they never grant elevated access
// if the cache is absent or contains an unexpected value.
// ---------------------------------------------------------------------------

export function isLoggedIn(): boolean {
  return localStorage.getItem('crmAuthMode') !== null;
}

export function getRole(): UserRole {
  const stored = localStorage.getItem('userRole');
  return stored === 'admin' ? 'admin' : 'staff';
}

export function isAdmin(): boolean {
  return getRole() === 'admin';
}

export function getCurrentUser(): CRMUser | null {
  if (!isLoggedIn()) return null;
  const email = localStorage.getItem('userEmail') ?? '';
  const storedRole = localStorage.getItem('userRole');
  const role: UserRole = storedRole === 'admin' ? 'admin' : 'staff';
  const name = localStorage.getItem('userName') ?? 'User';
  return { email, role, name };
}

// ---------------------------------------------------------------------------
// Async login
// When Supabase is configured: validates credentials server-side via
// supabase.auth.signInWithPassword, then fetches the role from staff_roles.
// When Supabase is NOT configured (local dev): uses a hardcoded dev fallback
// so the app works before credentials are wired up.
// ---------------------------------------------------------------------------

export async function login(email: string, password: string): Promise<CRMUser | null> {
  const trimmedEmail = email.toLowerCase().trim();

  if (!isSupabaseConfigured) {
    // Dev fallback — ONLY active in local development (Vite dev server).
    // In production builds, Supabase credentials are required.
    if (import.meta.env.PROD) {
      console.error('[auth] Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return null;
    }
    const DEV: Record<string, { password: string; role: UserRole; name: string }> = {
      'admin@gmail.com': { password: 'admin123', role: 'admin', name: 'Dr. Admin' },
      'staff@gmail.com': { password: 'staff123', role: 'staff', name: 'Staff Member' },
    };
    const cred = DEV[trimmedEmail];
    if (!cred || cred.password !== password) return null;
    _cacheUser('dev', trimmedEmail, cred.name, cred.role);
    return { email: trimmedEmail, name: cred.name, role: cred.role };
  }

  // Supabase Auth — server-side credential validation
  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });
  if (error || !data.user) return null;

  // Fetch role from staff_roles table (admin must insert rows manually)
  const { data: roleRow } = await supabase
    .from('staff_roles')
    .select('role, name')
    .eq('user_id', data.user.id)
    .single();

  const role: UserRole = roleRow?.role === 'admin' ? 'admin' : 'staff';
  const name: string = roleRow?.name ?? data.user.email ?? 'User';

  _cacheUser('supabase', data.user.email ?? trimmedEmail, name, role);
  return { email: data.user.email ?? trimmedEmail, name, role };
}

// ---------------------------------------------------------------------------
// Async logout
// ---------------------------------------------------------------------------

export async function logout(): Promise<void> {
  const mode = localStorage.getItem('crmAuthMode');
  if (mode === 'supabase') {
    await supabase.auth.signOut().catch(() => {});
  }
  _clearCache();
}

// ---------------------------------------------------------------------------
// Async session validation — call from CRMLayout on mount to verify that
// any Supabase session stored in the browser is still valid server-side.
// Dev-mode sessions skip server validation (no token to check).
// ---------------------------------------------------------------------------

export async function validateSession(): Promise<boolean> {
  const mode = localStorage.getItem('crmAuthMode');
  if (mode === 'dev') return true;
  if (mode !== 'supabase') return false;

  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      _clearCache();
      return false;
    }
    return true;
  } catch {
    _clearCache();
    return false;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _cacheUser(mode: string, email: string, name: string, role: UserRole) {
  localStorage.setItem('crmAuthMode', mode);
  localStorage.setItem('userEmail', email);
  localStorage.setItem('userName', name);
  localStorage.setItem('userRole', role);
}

function _clearCache() {
  ['crmAuthMode', 'userEmail', 'userName', 'userRole', 'adminLoggedIn'].forEach(k =>
    localStorage.removeItem(k)
  );
}
