import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

export function SchoolProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing loading state to auth state change
      setLoading(false);
      return;
    }
    schoolsApi
      .list({ limit: 100 })
      .then((res: { items?: School[] }) => {
        const items = res.items || [];
        setSchools(items);
        if (items.length > 0) setCurrentSchool(items[0]);
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
