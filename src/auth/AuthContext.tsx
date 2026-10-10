import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { usersApi, getToken, setToken, clearToken, ApiError } from '../api/client';
import { APP_VARIANT, OTP_AUDIENCE, roleAllowed, wrongAppMessage } from '../config/appVariant';

type JwtClaims = {
  sub: string;
  role: string;
  school_id?: string;
};

export type AuthUser = {
  id: string;
  role: string;
  schoolId: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  /** Switch to a token the server just issued (e.g. after a password change). */
  replaceSession: (token: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function decode(token: string): AuthUser | null {
  try {
    const claims = jwtDecode<JwtClaims>(token);
    return { id: claims.sub, role: claims.role, schoolId: claims.school_id || null };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(async token => {
      const saved = token ? decode(token) : null;
      // A session saved by a build for a different audience is dropped.
      if (saved && !roleAllowed(saved.role)) await clearToken();
      else if (saved) setUser(saved);
      setLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    await startSession((await usersApi.login(email, password)).token);
  }

  async function loginWithOtp(phone: string, otp: string) {
    await startSession((await usersApi.verifyLoginOtp(phone, otp, OTP_AUDIENCE[APP_VARIANT])).token);
  }

  async function startSession(token: string) {
    const decoded = decode(token);
    if (!decoded) throw new ApiError('Received an invalid session token', 500);
    // Each app is for one audience; don't keep a session from the wrong one.
    if (!roleAllowed(decoded.role)) throw new ApiError(wrongAppMessage(decoded.role), 403);
    await setToken(token);
    setUser(decoded);
  }

  async function logout() {
    await clearToken();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, loginWithOtp, replaceSession: startSession, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
