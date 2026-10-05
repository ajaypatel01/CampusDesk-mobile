import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { resultsApi, Exam, ExamSubjectFormat } from '../../api/client';
import { Badge, Button, Card, Empty, colors, confirm, styles as ui } from './ui';

type Row = { key: string; label: string; max: string };

/**
 * Per-exam marks distribution: every subject in an exam can have its own
 * fields (Unit Test: Written /20; Half Yearly: Written /60 + Oral /10). A
 * subject without one uses its own fields from the Subjects tab. Admin-only --
 * the backend blocks teachers and parents from changing formats.
 */
export default function ExamFormatEditor({ exam, onChanged }: { exam: Exam; onChanged?: () => void }) {
  const [formats, setFormats] = useState<ExamSubjectFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ subjectId: string; rows: Row[] } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resultsApi
      .listExamFormats(exam.id)
      .then(r => !cancelled && setFormats(r.items || []))
      .catch(err => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [exam.id]);

  function startEdit(f: ExamSubjectFormat) {
    setError('');
    setEditing({ subjectId: f.subject_id, rows: f.components.map(c => ({ key: c.key, label: c.label, max: String(c.max_marks) })) });
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setEditing(prev => (prev ? { ...prev, rows: prev.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) } : prev));
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      const res = await resultsApi.setExamSubjectFormat(
        exam.id,
        editing.subjectId,
        editing.rows.map(r => ({ key: r.key, label: r.label.trim(), max_marks: parseInt(r.max, 10) || 0 }))
      );
      setFormats(res.items || []);
      setEditing(null);
      onChanged?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function reset(f: ExamSubjectFormat) {
    if (!(await confirm('Use subject fields?', `Use ${f.subject_name}'s own fields for ${exam.name} again?`, 'Use them'))) return;
    setError('');
    try {
      const res = await resultsApi.resetExamSubjectFormat(exam.id, f.subject_id);
      setFormats(res.items || []);
      onChanged?.();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />;

  return (
    <View>
      <Text style={[ui.muted, { marginBottom: 10 }]}>
        Set how each subject is marked in {exam.name}. Subjects you don&apos;t change use their own fields from the Subjects tab. Remove every field to enter one plain mark.
      </Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {formats.length === 0 ? (
        <Empty text="No subjects for this grade yet." />
      ) : (
        formats.map(f => {
          const isEditing = editing?.subjectId === f.subject_id;
          const total = f.components.reduce((sum, c) => sum + c.max_marks, 0);
          return (
            <Card key={f.subject_id}>
              <View style={s.header}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.title}>{f.subject_name}</Text>
                  <Badge label={f.custom ? 'For this exam' : "Subject's own fields"} tone={f.custom ? 'success' : 'muted'} />
                </View>
                {!isEditing && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Button small variant="outline" label="Edit" onPress={() => startEdit(f)} />
                    {f.custom && <Button small variant="outline" label="Reset" onPress={() => reset(f)} />}
                  </View>
                )}
              </View>

              {isEditing && editing ? (
                <View style={{ marginTop: 10 }}>
                  {editing.rows.length === 0 && <Text style={ui.muted}>No fields -- one plain mark out of {f.max_marks}.</Text>}
                  {editing.rows.map((row, i) => (
                    <View key={i} style={s.editRow}>
                      <TextInput
                        style={[ui.input, { flex: 1 }]}
                        placeholder="Field name (e.g. Oral)"
                        placeholderTextColor={colors.textFaint}
                        value={row.label}
                        onChangeText={label => updateRow(i, { label })}
                      />
                      <TextInput
                        style={[ui.input, { width: 70 }]}
                        placeholder="Max"
                        placeholderTextColor={colors.textFaint}
                        keyboardType="number-pad"
                        value={row.max}
                        onChangeText={max => updateRow(i, { max })}
                      />
                      <TouchableOpacity
                        accessibilityLabel={`Remove ${row.label || 'field'}`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => setEditing(prev => (prev ? { ...prev, rows: prev.rows.filter((_, j) => j !== i) } : prev))}
                      >
                        <Text style={s.remove}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <Text style={ui.muted}>Fields total {editing.rows.reduce((sum, r) => sum + (parseInt(r.max, 10) || 0), 0)}</Text>
                  <View style={ui.buttonRow}>
                    <Button
                      small
                      variant="outline"
                      label="+ Add Field"
                      onPress={() => setEditing(prev => (prev ? { ...prev, rows: [...prev.rows, { key: '', label: '', max: '' }] } : prev))}
                    />
                    <Button small label="Save" onPress={save} loading={saving} />
                    <Button small variant="outline" label="Cancel" onPress={() => setEditing(null)} disabled={saving} />
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: 8 }}>
                  {f.components.length === 0 ? (
                    <Text style={ui.muted}>One plain mark out of {f.max_marks}.</Text>
                  ) : (
                    <>
                      <View style={s.chips}>
                        {f.components.map(c => (
                          <View key={c.key} style={s.chip}>
                            <Text style={s.chipText}>
                              {c.label} <Text style={ui.muted}>/{c.max_marks}</Text>
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text style={ui.muted}>Total {total}</Text>
                    </>
                  )}
                </View>
              )}
            </Card>
          );
        })
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  error: { color: colors.danger, marginBottom: 10, fontSize: 13 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  remove: { fontSize: 22, color: colors.danger, fontWeight: '700', paddingHorizontal: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 13, color: colors.text },
});
