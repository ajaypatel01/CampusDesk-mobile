import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSchool } from '../school/SchoolContext';
import { useAuth } from '../auth/AuthContext';
import { resultsApi, studentsApi, academicApi, GradeLevel, Exam, Student, Subject, ClassSection } from '../api/client';
import { ResultsContext } from './results/types';
import SubjectsTab from './results/SubjectsTab';
import ExamsTab from './results/ExamsTab';
import MarksTab from './results/MarksTab';
import MarksheetTab from './results/MarksheetTab';
import ReportCardTab from './results/ReportCardTab';
import { colors } from './results/ui';

type TabKey = 'subjects' | 'exams' | 'marks' | 'marksheet' | 'report-card';

const ALL_TABS: { key: TabKey; label: string }[] = [
  { key: 'subjects', label: 'Subjects' },
  { key: 'exams', label: 'Exams' },
  { key: 'marks', label: 'Enter Marks' },
  { key: 'marksheet', label: 'Marksheet' },
  { key: 'report-card', label: 'Report Card' },
];
// Teachers only enter marks and view marksheets; subjects, exams and report
// cards are managed by admins. Same split as the web Results page.
const TEACHER_TABS: TabKey[] = ['marks', 'marksheet'];

export default function ResultsScreen() {
  const { currentSchool, currentYear, loading: schoolLoading } = useSchool();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const isSuperAdmin = user?.role === 'super_admin';
  const tabs = useMemo(() => (isTeacher ? ALL_TABS.filter(t => TEACHER_TABS.includes(t.key)) : ALL_TABS), [isTeacher]);
  const [tab, setTab] = useState<TabKey>(isTeacher ? 'marks' : 'subjects');

  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [gradesLoaded, setGradesLoaded] = useState(false);
  const [gradeId, setGradeId] = useState('');
  // A teacher's own homeroom sections: they only see those grades, and only
  // students the backend lets them save marks for (same section, not just grade).
  const [mySections, setMySections] = useState<ClassSection[]>([]);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [formatExamId, setFormatExamId] = useState<string | null>(null);

  const openExamFormat = useCallback((examId: string | null) => {
    setFormatExamId(examId);
    if (examId) setTab('exams');
  }, []);

  useEffect(() => {
    if (!currentSchool || !currentYear) return;
    let cancelled = false;
    const load = isTeacher
      ? Promise.all([
          academicApi.listGrades(currentSchool.id),
          academicApi.listSections({ school_id: currentSchool.id, academic_year_id: currentYear.id }),
        ]).then(([gradeRes, sectionRes]: [{ items: GradeLevel[] }, { items?: ClassSection[] }]) => {
          const own = (sectionRes.items || []).filter(s => s.homeroom_teacher_id === user?.id);
          const ownGradeIds = new Set(own.map(s => s.grade_level_id));
          return { grades: (gradeRes.items || []).filter(g => ownGradeIds.has(g.id)), sections: own };
        })
      : academicApi.listGrades(currentSchool.id).then(r => ({ grades: r.items || [], sections: [] as ClassSection[] }));
    load
      .then(({ grades: g, sections }) => {
        if (cancelled) return;
        setGrades(g);
        setMySections(sections);
        setGradeId(prev => (prev && g.some(x => x.id === prev) ? prev : g[0]?.id || ''));
      })
      .catch(() => {
        if (cancelled) return;
        setGrades([]);
        setMySections([]);
      })
      .finally(() => !cancelled && setGradesLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [currentSchool, currentYear, isTeacher, user?.id]);

  const gradeName = grades.find(g => g.id === gradeId)?.name || '';

  const reloadSubjects = useCallback(() => {
    if (!currentSchool || !gradeId) return;
    resultsApi
      .listSubjects({ school_id: currentSchool.id, grade_level_id: gradeId })
      .then(r => setSubjects(r.items || []))
      .catch(() => setSubjects([]));
  }, [currentSchool, gradeId]);

  const reloadExams = useCallback(() => {
    if (!currentSchool || !currentYear || !gradeId) return;
    resultsApi
      .listExams({ school_id: currentSchool.id, academic_year_id: currentYear.id, grade_level_id: gradeId })
      .then(r => setExams(r.items || []))
      .catch(() => setExams([]));
  }, [currentSchool, currentYear, gradeId]);

  useEffect(() => {
    reloadSubjects();
    reloadExams();
  }, [reloadSubjects, reloadExams]);

  useEffect(() => {
    if (!currentSchool || !currentYear || !gradeId || !gradeName) return;
    const params: Record<string, string | number> = {
      school_id: currentSchool.id,
      academic_year_id: currentYear.id,
      grade_level: gradeName,
      limit: 500,
    };
    if (isTeacher) {
      const sectionIds = mySections.filter(s => s.grade_level_id === gradeId).map(s => s.id);
      if (!sectionIds.length) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- no own section in this grade, nothing to fetch
        setStudents([]);
        return;
      }
      params.class_section_ids = sectionIds.join(',');
    }
    studentsApi
      .list(params)
      .then((r: { items?: Student[] }) => setStudents(r.items || []))
      .catch(() => setStudents([]));
  }, [currentSchool, currentYear, gradeId, gradeName, isTeacher, mySections]);

  if (schoolLoading || (currentSchool && currentYear && !gradesLoaded)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!currentSchool || !currentYear) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notice}>Select a school and academic year first.</Text>
      </View>
    );
  }

  if (isTeacher && grades.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notice}>
          You haven&apos;t been assigned as a class teacher yet. Ask your school admin to assign you to a class section under Settings → Grades &amp; Sections.
        </Text>
      </View>
    );
  }

  const ctx: ResultsContext = {
    schoolId: currentSchool.id,
    year: currentYear,
    gradeId,
    gradeName,
    isTeacher,
    isSuperAdmin,
    subjects,
    exams,
    students,
    reloadSubjects,
    reloadExams,
    formatExamId,
    openExamFormat,
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>GRADE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {grades.map(g => (
            <TouchableOpacity
              key={g.id}
              accessibilityRole="button"
              accessibilityState={{ selected: gradeId === g.id }}
              style={[styles.chip, gradeId === g.id && styles.chipActive]}
              onPress={() => {
                setGradeId(g.id);
                setFormatExamId(null);
              }}
            >
              <Text style={[styles.chipText, gradeId === g.id && styles.chipTextActive]}>{g.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {tabs.map(t => (
            <TouchableOpacity
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.key }}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* key on grade resets each tab's pickers/forms when the grade changes */}
        <View key={gradeId}>
          {tab === 'subjects' && !isTeacher && <SubjectsTab ctx={ctx} />}
          {tab === 'exams' && !isTeacher && <ExamsTab ctx={ctx} />}
          {tab === 'marks' && <MarksTab ctx={ctx} />}
          {tab === 'marksheet' && <MarksheetTab ctx={ctx} />}
          {tab === 'report-card' && !isTeacher && <ReportCardTab ctx={ctx} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  notice: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, letterSpacing: 0.5 },
  chipRow: { gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: '#fff' },
  tabRow: { gap: 8, paddingBottom: 16 },
  tab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  tabText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
});
