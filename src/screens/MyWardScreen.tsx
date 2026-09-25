import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  academicApi,
  studentsApi,
  homeworkApi,
  resultsApi,
  AcademicYear,
  Student,
  WardHomeworkItem,
  Exam,
  Marksheet,
} from '../api/client';
import { useAuth } from '../auth/AuthContext';

const STATUS_COLORS: Record<string, string> = {
  submitted: '#16a34a',
  late: '#d97706',
  missing: '#dc2626',
  pending: '#64748b',
};

function fmtDate(d?: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN');
}

export default function MyWardScreen() {
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [wards, setWards] = useState<Student[]>([]);
  const [selectedWardId, setSelectedWardId] = useState('');

  const [homework, setHomework] = useState<WardHomeworkItem[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [marksheet, setMarksheet] = useState<Marksheet | null>(null);
  const [marksheetLoading, setMarksheetLoading] = useState(false);

  const ward = wards.find(w => w.id === selectedWardId) || null;

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const wardsRes = await studentsApi.myWards();
      const wardItems = wardsRes.items || [];
      setWards(wardItems);
      const firstWardId = wardItems[0]?.id || '';
      setSelectedWardId(prev => prev || firstWardId);

      if (user?.schoolId) {
        const yearsRes = await academicApi.listYears(user.schoolId);
        const years = yearsRes.items || [];
        const current = years.find(y => y.is_current) || years[0] || null;
        setCurrentYear(current);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    }
  }, [user]);

  useEffect(() => {
    // Standard fetch-on-mount pattern; the new set-state-in-effect rule flags this
    // whenever the effect transitively calls setState, even via an awaited async
    // function. Adopting a data-fetching library to satisfy it isn't warranted here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  useEffect(() => {
    if (!selectedWardId || !currentYear) return;
    homeworkApi
      .wardHomework(selectedWardId, currentYear.id)
      .then(res => setHomework(res.items || []))
      .catch(() => setHomework([]));
    resultsApi
      .wardExams(selectedWardId, currentYear.id)
      .then(res => {
        setExams(res.items || []);
        setSelectedExamId('');
        setMarksheet(null);
      })
      .catch(() => setExams([]));
  }, [selectedWardId, currentYear]);

  useEffect(() => {
    if (!selectedExamId || !selectedWardId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off a load spinner for the fetch below
    setMarksheetLoading(true);
    resultsApi
      .getMarksheet(selectedExamId, selectedWardId)
      .then(setMarksheet)
      .catch(() => setMarksheet(null))
      .finally(() => setMarksheetLoading(false));
  }, [selectedExamId, selectedWardId]);

  function onSelectExam(id: string) {
    setSelectedExamId(id);
    setMarksheet(null);
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (wards.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          {error || "No ward is linked to your account yet. Contact your school's registrar or admin."}
        </Text>
        <TouchableOpacity style={styles.logoutLink} onPress={logout}>
          <Text style={styles.logoutLinkText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>My Ward</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutLinkText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {wards.length > 1 && (
        <View style={styles.pickerWrap}>
          <Picker selectedValue={selectedWardId} onValueChange={v => setSelectedWardId(v)}>
            {wards.map(w => (
              <Picker.Item key={w.id} label={`${w.first_name} ${w.last_name} (${w.student_code})`} value={w.id} />
            ))}
          </Picker>
        </View>
      )}

      {ward && (
        <View style={styles.card}>
          <Text style={styles.wardName}>
            {ward.first_name} {ward.last_name}
          </Text>
          <Text style={styles.wardMeta}>Scholar No: {ward.student_code}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Class Homework</Text>
      <View style={styles.card}>
        {homework.length === 0 ? (
          <Text style={styles.emptyInline}>No homework assigned yet</Text>
        ) : (
          homework.map(hw => (
            <View key={hw.id} style={styles.homeworkRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.homeworkTitle}>{hw.title}</Text>
                <Text style={styles.homeworkDue}>Due {fmtDate(hw.due_date)}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[hw.submission_status || ''] || '#64748b') + '22' }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLORS[hw.submission_status || ''] || '#64748b' }]}>
                  {hw.submission_status || 'not tracked'}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Results</Text>
      <View style={styles.card}>
        {exams.length === 0 ? (
          <Text style={styles.emptyInline}>No published exams yet</Text>
        ) : (
          <>
            <View style={styles.pickerWrapInline}>
              <Picker selectedValue={selectedExamId} onValueChange={v => onSelectExam(v)}>
                <Picker.Item label="Select exam" value="" />
                {exams.map(ex => (
                  <Picker.Item key={ex.id} label={ex.name} value={ex.id} />
                ))}
              </Picker>
            </View>

            {marksheetLoading && <ActivityIndicator color="#4f46e5" style={{ marginTop: 12 }} />}

            {marksheet && (
              <View style={styles.marksheet}>
                <Text style={styles.marksheetTitle}>
                  {marksheet.exam_name} · {marksheet.academic_year}
                </Text>
                {marksheet.rows.map((row, i) => (
                  <View key={i} style={styles.marksRow}>
                    <Text style={styles.marksSubject}>{row.subject_name}</Text>
                    <Text style={styles.marksValue}>
                      {row.is_absent ? 'Absent' : `${row.marks_obtained}/${row.max_marks}`}
                    </Text>
                    <Text style={[styles.marksStatus, { color: row.status === 'Pass' ? '#16a34a' : row.status === 'Fail' ? '#dc2626' : '#64748b' }]}>
                      {row.status}
                    </Text>
                  </View>
                ))}
                <Text style={styles.marksTotal}>
                  Total: {marksheet.total_obtained}/{marksheet.total_max} ({marksheet.percentage.toFixed(1)}%) · {marksheet.result}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  logoutLinkText: { color: '#4f46e5', fontWeight: '600', fontSize: 14 },
  logoutLink: { marginTop: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pickerWrap: { backgroundColor: '#fff', borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  pickerWrapInline: { backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 8 },
  wardName: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  wardMeta: { color: '#64748b', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 8 },
  emptyInline: { color: '#94a3b8', fontSize: 13 },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  homeworkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  homeworkTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  homeworkDue: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  marksheet: { marginTop: 12 },
  marksheetTitle: { fontWeight: '700', marginBottom: 8, color: '#0f172a' },
  marksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  marksSubject: { flex: 1, fontSize: 13, color: '#0f172a' },
  marksValue: { fontSize: 13, color: '#334155', marginHorizontal: 8 },
  marksStatus: { fontSize: 13, fontWeight: '600' },
  marksTotal: { marginTop: 10, fontWeight: '700', color: '#0f172a' },
});
