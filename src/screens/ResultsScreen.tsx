import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, FlatList } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useSchool } from '../school/SchoolContext';
import { resultsApi, studentsApi, academicApi, GradeLevel, Exam, Marksheet, Student } from '../api/client';

export default function ResultsScreen() {
  const { currentSchool, currentYear, loading: schoolLoading } = useSchool();
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [gradeId, setGradeId] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);

  const [studentQuery, setStudentQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [marksheet, setMarksheet] = useState<Marksheet | null>(null);
  const [marksheetLoading, setMarksheetLoading] = useState(false);

  useEffect(() => {
    if (!currentSchool) return;
    academicApi
      .listGrades(currentSchool.id)
      .then(res => {
        setGrades(res.items || []);
        setGradeId(res.items?.[0]?.id || '');
      })
      .catch(() => setGrades([]));
  }, [currentSchool]);

  const loadExams = useCallback(() => {
    if (!currentSchool || !currentYear || !gradeId) return;
    setLoadingExams(true);
    resultsApi
      .listExams({ school_id: currentSchool.id, academic_year_id: currentYear.id, grade_level_id: gradeId })
      .then(res => setExams(res.items || []))
      .catch(() => setExams([]))
      .finally(() => setLoadingExams(false));
  }, [currentSchool, currentYear, gradeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/on-grade-change
    loadExams();
  }, [loadExams]);

  function searchStudents(q: string) {
    setStudentQuery(q);
    if (!currentSchool || q.trim().length < 2) {
      setStudents([]);
      return;
    }
    studentsApi
      .list({ school_id: currentSchool.id, search: q, limit: 10 })
      .then((res: { items?: Student[] }) => setStudents(res.items || []))
      .catch(() => setStudents([]));
  }

  useEffect(() => {
    if (!selectedExamId || !selectedStudentId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off a load spinner for the fetch below
    setMarksheetLoading(true);
    resultsApi
      .getMarksheet(selectedExamId, selectedStudentId)
      .then(setMarksheet)
      .catch(err => {
        setMarksheet(null);
        Alert.alert('Could not load marksheet', err.message);
      })
      .finally(() => setMarksheetLoading(false));
  }, [selectedExamId, selectedStudentId]);

  async function togglePublish(exam: Exam & { is_published?: boolean }) {
    try {
      await resultsApi.publishExam(exam.id, !exam.is_published);
      loadExams();
    } catch (err: any) {
      Alert.alert('Failed', err.message);
    }
  }

  if (schoolLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Exams</Text>
      <View style={styles.card}>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={gradeId} onValueChange={setGradeId}>
            {grades.map(g => (
              <Picker.Item key={g.id} label={g.name} value={g.id} />
            ))}
          </Picker>
        </View>
        {loadingExams ? (
          <ActivityIndicator color="#4f46e5" style={{ marginTop: 12 }} />
        ) : exams.length === 0 ? (
          <Text style={styles.emptyInline}>No exams for this grade yet</Text>
        ) : (
          exams.map((ex: Exam & { is_published?: boolean }) => (
            <View key={ex.id} style={styles.examRow}>
              <Text style={styles.examName}>{ex.name}</Text>
              <TouchableOpacity onPress={() => togglePublish(ex)}>
                <Text style={[styles.publishLabel, { color: ex.is_published ? '#16a34a' : '#94a3b8' }]}>
                  {ex.is_published ? 'Published' : 'Unpublished'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Look up a marksheet</Text>
      <View style={styles.card}>
        <TextInput style={styles.input} placeholder="Search student by name or scholar no..." value={studentQuery} onChangeText={searchStudents} />
        {students.length > 0 && (
          <FlatList
            data={students}
            keyExtractor={s => s.id}
            style={{ maxHeight: 160, marginTop: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.studentResultRow}
                onPress={() => {
                  setSelectedStudentId(item.id);
                  setStudentQuery(`${item.first_name} ${item.last_name} (${item.student_code})`);
                  setStudents([]);
                }}
              >
                <Text>
                  {item.first_name} {item.last_name} ({item.student_code})
                </Text>
              </TouchableOpacity>
            )}
          />
        )}

        {selectedStudentId && (
          <View style={styles.pickerWrap}>
            <Picker selectedValue={selectedExamId} onValueChange={setSelectedExamId}>
              <Picker.Item label="Select exam" value="" />
              {exams.map(ex => (
                <Picker.Item key={ex.id} label={ex.name} value={ex.id} />
              ))}
            </Picker>
          </View>
        )}

        {marksheetLoading && <ActivityIndicator color="#4f46e5" style={{ marginTop: 12 }} />}

        {marksheet && (
          <View style={styles.marksheet}>
            <Text style={styles.marksheetTitle}>
              {marksheet.student_name} ({marksheet.student_code}) · {marksheet.exam_name}
            </Text>
            {marksheet.rows.map((row, i) => (
              <View key={i} style={styles.marksRow}>
                <Text style={styles.marksSubject}>{row.subject_name}</Text>
                <Text style={styles.marksValue}>{row.is_absent ? 'Absent' : `${row.marks_obtained}/${row.max_marks}`}</Text>
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
  pickerWrap: { backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 8 },
  emptyInline: { color: '#94a3b8', fontSize: 13, marginTop: 8 },
  examRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  examName: { fontSize: 14, color: '#0f172a', fontWeight: '600' },
  publishLabel: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  studentResultRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0' },
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
