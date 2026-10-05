import { useState } from 'react';
import { View, Text, TextInput, Switch, StyleSheet } from 'react-native';
import { resultsApi, Subject } from '../../api/client';
import { ResultsContext, studentLabel } from './types';
import MarkFieldsEditor from './MarkFieldsEditor';
import { Button, Card, Empty, Message, SectionHeader, Select, colors, styles as ui } from './ui';

type Entry = { marks_obtained?: string; is_absent?: boolean; components?: Record<string, string> };

/** Enter one student's marks for one exam, every subject at once. Teachers and admins. */
export default function MarksTab({ ctx }: { ctx: ResultsContext }) {
  const [examId, setExamId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [marks, setMarks] = useState<Record<string, Entry>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Start blank whenever the exam or student changes, so one student's
  // numbers can never be saved against the next.
  function pickExam(id: string) {
    setExamId(id);
    setMarks({});
    setMsg('');
  }
  function pickStudent(id: string) {
    setStudentId(id);
    setMarks({});
    setMsg('');
  }

  function update(subjectId: string, patch: Entry) {
    setMarks(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], ...patch } }));
  }

  function componentTotal(sub: Subject) {
    const vals = marks[sub.id]?.components || {};
    return (sub.mark_components || []).reduce((sum, c) => sum + (parseFloat(vals[c.key]) || 0), 0);
  }

  async function save() {
    if (!examId || !studentId) return;
    setSaving(true);
    setMsg('');
    try {
      const payload = ctx.subjects.map(sub => {
        const entry = marks[sub.id] || {};
        const base = {
          exam_id: examId,
          student_id: studentId,
          subject_id: sub.id,
          max_marks: sub.max_marks,
          is_absent: entry.is_absent || false,
          remarks: '',
        };
        const comps = sub.mark_components || [];
        if (comps.length > 0) {
          const components: Record<string, number> = {};
          comps.forEach(c => {
            components[c.key] = parseFloat(entry.components?.[c.key] || '0') || 0;
          });
          return { ...base, components };
        }
        return { ...base, marks_obtained: parseFloat(entry.marks_obtained || '0') || 0 };
      });
      await resultsApi.bulkUpsertMarks(payload);
      setMsg('Marks saved successfully.');
    } catch (err: any) {
      setMsg('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View>
      <SectionHeader title="Enter Marks" />
      <Card>
        <Select
          label="Exam *"
          value={examId}
          onChange={pickExam}
          placeholder="Select exam..."
          options={ctx.exams.map(e => ({ label: e.name, value: e.id }))}
        />
        <Select
          label="Student *"
          value={studentId}
          onChange={pickStudent}
          placeholder={ctx.students.length ? 'Select student...' : 'No students in this class'}
          options={ctx.students.map(s => ({ label: studentLabel(s), value: s.id }))}
        />
      </Card>

      {ctx.exams.length === 0 && (
        <Empty
          text={`No exams yet for this grade -- ${ctx.isTeacher ? 'ask your admin or registrar to add one before you can enter marks.' : 'add one under the Exams tab first.'}`}
        />
      )}
      {ctx.subjects.length === 0 && <Empty text="No subjects found for this grade. Add subjects first." />}

      {examId && studentId && ctx.subjects.length > 0 && (
        <>
          {ctx.subjects.map(sub => {
            const comps = sub.mark_components || [];
            const absent = marks[sub.id]?.is_absent || false;
            return (
              <Card key={sub.id}>
                <View style={s.header}>
                  <Text style={s.title}>{sub.name}</Text>
                  <View style={s.absent}>
                    <Text style={ui.muted}>Absent</Text>
                    <Switch value={absent} onValueChange={v => update(sub.id, { is_absent: v })} trackColor={{ true: colors.danger }} />
                  </View>
                </View>

                {comps.length > 0 ? (
                  <View style={s.grid}>
                    {comps.map(c => (
                      <View key={c.key} style={s.gridCell}>
                        <Text style={ui.fieldLabel}>
                          {c.label} <Text style={ui.muted}>/{c.max_marks}</Text>
                        </Text>
                        <MarkInput
                          disabled={absent}
                          value={marks[sub.id]?.components?.[c.key] || ''}
                          onChange={v => update(sub.id, { components: { ...marks[sub.id]?.components, [c.key]: v } })}
                        />
                      </View>
                    ))}
                  </View>
                ) : (
                  <View>
                    <Text style={ui.fieldLabel}>
                      Marks <Text style={ui.muted}>/{sub.max_marks}</Text>
                    </Text>
                    <MarkInput
                      disabled={absent}
                      placeholder={`out of ${sub.max_marks}`}
                      value={marks[sub.id]?.marks_obtained || ''}
                      onChange={v => update(sub.id, { marks_obtained: v })}
                    />
                  </View>
                )}

                <Text style={s.total}>
                  {comps.length > 0 ? `Total: ${componentTotal(sub)} / ${sub.max_marks}` : `Out of ${sub.max_marks}`}
                </Text>

                {/* Teachers only enter marks -- adding mark fields is subject setup. */}
                {!ctx.isTeacher && <MarkFieldsEditor subject={sub} onChanged={ctx.reloadSubjects} showChips={false} />}
              </Card>
            );
          })}
          <Message text={msg} />
          <View style={{ marginTop: 8 }}>
            <Button label="Save Marks" onPress={save} loading={saving} />
          </View>
        </>
      )}
    </View>
  );
}

function MarkInput({ value, onChange, disabled, placeholder }: { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  return (
    <TextInput
      style={[ui.input, disabled && ui.inputDisabled]}
      editable={!disabled}
      keyboardType="decimal-pad"
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      value={value}
      onChangeText={onChange}
    />
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  absent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCell: { width: '47%' },
  total: { marginTop: 10, fontSize: 13, fontWeight: '600', color: colors.textMuted },
});
