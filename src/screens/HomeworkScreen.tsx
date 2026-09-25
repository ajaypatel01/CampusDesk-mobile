import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useSchool } from '../school/SchoolContext';
import { homeworkApi, academicApi, GradeLevel } from '../api/client';

type Assignment = { id: string; title: string; description?: string; due_date: string };
type Submission = { id: string; student_id: string; status: string };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN');
}

export default function HomeworkScreen() {
  const { currentSchool, currentYear, loading: schoolLoading } = useSchool();
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', due_date: '' });

  useEffect(() => {
    if (!currentSchool) return;
    academicApi
      .listGrades(currentSchool.id)
      .then(res => {
        setGrades(res.items || []);
        setGradeId(res.items?.[0]?.id || null);
      })
      .catch(() => setGrades([]));
  }, [currentSchool]);

  const load = useCallback(() => {
    if (!currentSchool || !currentYear || !gradeId) return;
    setLoading(true);
    homeworkApi
      .list({ school_id: currentSchool.id, academic_year_id: currentYear.id, grade_level_id: gradeId })
      .then((res: { items?: Assignment[] }) => setAssignments(res.items || []))
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  }, [currentSchool, currentYear, gradeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/on-grade-change
    load();
  }, [load]);

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    homeworkApi
      .listSubmissions(id)
      .then((res: { items?: Submission[] }) => setSubmissions(res.items || []))
      .catch(() => setSubmissions([]));
  }

  async function handleAdd() {
    if (!currentSchool || !currentYear || !gradeId || !form.title.trim() || !form.due_date.trim()) {
      Alert.alert('Title and due date are required');
      return;
    }
    setSaving(true);
    try {
      await homeworkApi.create({
        school_id: currentSchool.id,
        academic_year_id: currentYear.id,
        grade_level_id: gradeId,
        title: form.title,
        description: form.description,
        due_date: form.due_date,
      });
      setShowForm(false);
      setForm({ title: '', description: '', due_date: '' });
      load();
    } catch (err: any) {
      Alert.alert('Failed to add', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await homeworkApi.remove(id);
      if (expandedId === id) setExpandedId(null);
      load();
    } catch (err: any) {
      Alert.alert('Failed to delete', err.message);
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
      <View style={styles.pickerWrap}>
        <Picker selectedValue={gradeId} onValueChange={setGradeId}>
          {grades.map(g => (
            <Picker.Item key={g.id} label={g.name} value={g.id} />
          ))}
        </Picker>
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.count}>{assignments.length} assignments</Text>
        <TouchableOpacity onPress={() => setShowForm(s => !s)}>
          <Text style={styles.addLink}>{showForm ? 'Cancel' : '+ Add homework'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Title *" value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} />
          <TextInput
            style={styles.input}
            placeholder="Description"
            value={form.description}
            onChangeText={v => setForm(f => ({ ...f, description: v }))}
            multiline
          />
          <TextInput
            style={styles.input}
            placeholder="Due date (YYYY-MM-DD) *"
            value={form.due_date}
            onChangeText={v => setForm(f => ({ ...f, due_date: v }))}
          />
          <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#4f46e5" style={{ marginTop: 16 }} />
      ) : assignments.length === 0 ? (
        <Text style={styles.emptyText}>No homework assigned for this grade yet</Text>
      ) : (
        assignments.map(a => (
          <View key={a.id} style={styles.card}>
            <TouchableOpacity onPress={() => toggleExpand(a.id)}>
              <Text style={styles.title}>{a.title}</Text>
              {a.description ? <Text style={styles.description}>{a.description}</Text> : null}
              <Text style={styles.due}>Due {fmtDate(a.due_date)}</Text>
            </TouchableOpacity>
            {expandedId === a.id && (
              <View style={styles.submissionsBox}>
                {submissions.length === 0 ? (
                  <Text style={styles.emptyInline}>No submissions tracked yet</Text>
                ) : (
                  submissions.map(s => (
                    <View key={s.id} style={styles.submissionRow}>
                      <Text style={styles.submissionStudent}>{s.student_id.slice(0, 8)}</Text>
                      <Text style={styles.submissionStatus}>{s.status}</Text>
                    </View>
                  ))
                )}
                <TouchableOpacity onPress={() => handleDelete(a.id)}>
                  <Text style={styles.deleteLink}>Delete assignment</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  pickerWrap: { backgroundColor: '#fff', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  count: { color: '#94a3b8', fontSize: 12 },
  addLink: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, gap: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 24 },
  emptyInline: { color: '#94a3b8', fontSize: 13 },
  title: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  description: { fontSize: 13, color: '#64748b', marginTop: 4 },
  due: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  submissionsBox: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0' },
  submissionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  submissionStudent: { fontSize: 12, color: '#334155' },
  submissionStatus: { fontSize: 12, color: '#64748b', textTransform: 'capitalize' },
  deleteLink: { color: '#dc2626', fontSize: 12, marginTop: 8, fontWeight: '600' },
});
