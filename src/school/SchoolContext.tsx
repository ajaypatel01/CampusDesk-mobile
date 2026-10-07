import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { schoolsApi, academicApi, AcademicYear } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export type School = { id: string; name: string; code: string };

type SchoolContextValue = {
  schools: School[];
  currentSchool: School | null;
  setCurrentSchool: (s: School) => void;
  academicYears: AcademicYear[];
  currentYear: AcademicYear | null;
  loading: boolean;
};

const SchoolContext = createContext<SchoolContextValue | null>(null);

// The owner's last chosen school, so the app reopens on it. SecureStore has no
// web implementation; localStorage there is only for `expo start --web` previews.
const SCHOOL_KEY = 'cd_school';
async function loadSavedSchoolId(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return window.localStorage.getItem(SCHOOL_KEY);
    return await SecureStore.getItemAsync(SCHOOL_KEY);
  } catch {
    return null;
  }
}
function saveSchoolId(id: string) {
  try {
    if (Platform.OS === 'web') window.localStorage.setItem(SCHOOL_KEY, id);
    else SecureStore.setItemAsync(SCHOOL_KEY, id).catch(() => {});
  } catch {
    // remembering the choice is a convenience; ignore storage failures
  }
}

export function SchoolProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [currentSchool, setCurrentSchoolState] = useState<School | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing loading state to auth state change
      setLoading(false);
      return;
    }
    Promise.all([schoolsApi.list({ limit: 100 }), loadSavedSchoolId()])
      .then(([res, savedId]: [{ items?: School[] }, string | null]) => {
        const items = res.items || [];
        setSchools(items);
        // Reopen on the last chosen school if this account can still see it.
        setCurrentSchoolState(items.find(sc => sc.id === savedId) || items[0] || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!currentSchool) return;
    academicApi
      .listYears(currentSchool.id)
      .then(res => {
        const items = res.items || [];
        setAcademicYears(items);
        setCurrentYear(items.find(y => y.is_current) || items[0] || null);
      })
      .catch(() => {});
  }, [currentSchool]);

  // Switching school drops the old school's years at once, so no screen ever
  // pairs the new school with the previous school's academic year.
  const setCurrentSchool = useCallback((sc: School) => {
    setCurrentSchoolState(prev => {
      if (prev?.id === sc.id) return prev;
      setAcademicYears([]);
      setCurrentYear(null);
      saveSchoolId(sc.id);
      return sc;
    });
  }, []);

  return (
    <SchoolContext.Provider value={{ schools, currentSchool, setCurrentSchool, academicYears, currentYear, loading }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool(): SchoolContextValue {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error('useSchool must be used within a SchoolProvider');
  return ctx;
}
