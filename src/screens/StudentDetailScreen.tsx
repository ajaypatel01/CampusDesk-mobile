import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { studentsApi, Student } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const SCHOLAR_NO_EDITOR_ROLES = ['registrar', 'super_admin'];

const FIELDS: { key: string; label: string; keyboardType?: 'default' | 'phone-pad' | 'email-address' }[] = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'gender', label: 'Gender' },
  { key: 'date_of_birth', label: 'Date of Birth (YYYY-MM-DD)' },
  { key: 'phone', label: 'Phone', keyboardType: 'phone-pad' },
  { key: 'email', label: 'Email', keyboardType: 'email-address' },
  { key: 'address', label: 'Address' },
  { key: 'caste', label: 'Caste' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
  { key: 'aadhar_number', label: 'Aadhar Number' },
  { key: 'samagra_id', label: 'Samagra ID' },
  { key: 'pen_number', label: 'PEN Number' },
  { key: 'apar_id', label: 'APAR ID' },
  { key: 'previous_school', label: 'Previous School' },
  { key: 'bank_name', label: 'Bank Name' },
  { key: 'bank_ifsc', label: 'IFSC Code' },
  { key: 'bank_account_number', label: 'Account Number' },
  { key: 'bank_holder_name', label: 'Account Holder' },
  { key: 'bank_branch', label: 'Branch' },
];

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const canEditScholarNo = SCHOLAR_NO_EDITOR_ROLES.includes(user?.role || '');

  const [student, setStudent] = useState<Student | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    studentsApi
      .get(id)
      .then(s => {
        setStudent(s);
        setForm(toFormValues(s));
      })
      .catch(err => Alert.alert('Failed to load', err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function toFormValues(s: Student): Record<string, string> {
    const out: Record<string, string> = { student_code: s.student_code || '' };
    for (const f of FIELDS) out[f.key] = s[f.key] != null ? String(s[f.key]).split('T')[0] : '';
    return out;
  }

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await studentsApi.update(id, form);
      setStudent(updated);
      setForm(toFormValues(updated));
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }
  if (!student) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Student not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {student.first_name[0]}
            {student.last_name[0]}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {student.first_name} {student.last_name}
          </Text>
          <Text style={styles.code}>{student.student_code}</Text>
        </View>
        {editing ? (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Ionicons name="create-outline" size={16} color="#4f46e5" />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <FieldRow
          label="Scholar No"
          value={form.student_code}
          editable={editing && canEditScholarNo}
          onChangeText={v => setForm(f => ({ ...f, student_code: v }))}
        />
        {FIELDS.map(f => (
          <FieldRow
            key={f.key}
            label={f.label}
            value={form[f.key]}
            editable={editing}
            keyboardType={f.keyboardType}
            onChangeText={v => setForm(fm => ({ ...fm, [f.key]: v }))}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function FieldRow({
  label,
  value,
  editable,
  keyboardType,
  onChangeText,
}: {
  label: string;
  value: string;
  editable: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editable ? (
        <TextInput style={styles.fieldInput} value={value} onChangeText={onChangeText} keyboardType={keyboardType} />
      ) : (
        <Text style={styles.fieldValue}>{value || '-'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  emptyText: { color: '#64748b' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#4f46e5', fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  code: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  editBtnText: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  fieldRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  fieldLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
  fieldValue: { fontSize: 14, color: '#0f172a' },
  fieldInput: {
    fontSize: 14,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
