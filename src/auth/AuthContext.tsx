import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { authApi, getToken, setToken, clearToken, ApiError } from '../api/client';

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
    getToken().then(token => {
      if (token) setUser(decode(token));
      setLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    const res = await authApi.login(email, password);
    const decoded = decode(res.token);
    if (!decoded) throw new ApiError('Received an invalid session token', 500);
    if (decoded.role !== 'parent') {
      throw new ApiError('This app is for parent accounts only. Use the CampusDesk website for staff logins.', 403);
    }
    await setToken(res.token);
    setUser(decoded);
  }

  async function logout() {
    await clearToken();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
