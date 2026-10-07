import { useEffect, useState } from 'react';
import { View, Text, TextInput, Switch, StyleSheet, TouchableOpacity } from 'react-native';
import { resultsApi, MarkComponent, Subject } from '../../api/client';
import { ResultsContext, studentLabel } from './types';
import { Button, Card, Empty, Message, SectionHeader, Select, colors, styles as ui } from './ui';

type Entry = { marks_obtained?: string; is_absent?: boolean; components?: Record<string, string>; grade_letter?: string };

// Grading-only (co-scholastic) subjects get one of these instead of marks.
const GRADE_LETTERS = ['A', 'B', 'C', 'D'];

/** Enter one student's marks for one exam, every subject at once. Teachers and admins. */
export default function MarksTab({ ctx }: { ctx: ResultsContext }) {
  const [examId, setExamId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [marks, setMarks] = useState<Record<string, Entry>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  // The selected exam's fields per subject (its own format, or the subject's fields).
  const [examFormats, setExamFormats] = useState<Record<string, MarkComponent[]>>({});

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    resultsApi
      .listExamFormats(examId)
      .then(r => !cancelled && setExamFormats(Object.fromEntries((r.items || []).map(f => [f.subject_id, f.components]))))
      .catch(() => !cancelled && setExamFormats({}));
    return () => {
      cancelled = true;
    };
  }, [examId]);

  function fieldsFor(sub: Subject): MarkComponent[] {
    return examFormats[sub.id] || sub.mark_components || [];
  }

  // Start blank whenever the exam or student changes, so one student's
  // numbers can never be saved against the next.
  function pickExam(id: string) {
    setExamId(id);
    setExamFormats({});
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
    return fieldsFor(sub).reduce((sum, c) => sum + (parseFloat(vals[c.key]) || 0), 0);
  }

  async function save() {
    if (!examId || !studentId) return;
    setSaving(true);
    setMsg('');
    try {
      // A grading-only subject with no grade picked is left out, so it is
      // never saved as 0 marks.
      const payload = ctx.subjects
        .filter(sub => {
          const entry = marks[sub.id] || {};
          return !sub.is_co_scholastic || entry.is_absent || entry.grade_letter;
        })
        .map(sub => {
        const entry = marks[sub.id] || {};
        const base = {
          exam_id: examId,
          student_id: studentId,
          subject_id: sub.id,
          max_marks: sub.max_marks,
          is_absent: entry.is_absent || false,
          remarks: '',
        };
        if (sub.is_co_scholastic) {
          return { ...base, grade_letter: entry.is_absent ? '' : entry.grade_letter };
        }
        const comps = fieldsFor(sub);
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
            const comps = fieldsFor(sub);
            const fieldsMax = comps.reduce((sum, c) => sum + c.max_marks, 0);
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

                {sub.is_co_scholastic ? (
                  <View>
                    <Text style={ui.fieldLabel}>
                      Grade <Text style={ui.muted}>(grading only)</Text>
                    </Text>
                    <View style={s.letters}>
                      {GRADE_LETTERS.map(g => {
                        const on = marks[sub.id]?.grade_letter === g;
                        return (
                          <TouchableOpacity
                            key={g}
                            disabled={absent}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on, disabled: absent }}
                            accessibilityLabel={`Grade ${g}`}
                            onPress={() => update(sub.id, { grade_letter: on ? '' : g })}
                            style={[s.letter, on && s.letterOn, absent && { opacity: 0.4 }]}
                          >
                            <Text style={[s.letterText, on && s.letterTextOn]}>{g}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : comps.length > 0 ? (
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
                  {sub.is_co_scholastic
                    ? 'Graded A–D, not counted in the total'
                    : comps.length > 0
                      ? `Total: ${componentTotal(sub)} / ${fieldsMax}`
                      : `Out of ${sub.max_marks}`}
                </Text>

                {/* Teachers only enter marks; admins change fields per exam under Exams > Marks format. */}
                {!ctx.isTeacher && (
                  <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                    <Button small variant="outline" label="Change fields for this exam" onPress={() => ctx.openExamFormat(examId)} />
                  </View>
                )}
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
  letters: { flexDirection: 'row', gap: 10 },
  letter: {
    width: 52,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  letterOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  letterText: { fontSize: 17, fontWeight: '700', color: colors.text },
  letterTextOn: { color: '#fff' },
  total: { marginTop: 10, fontSize: 13, fontWeight: '600', color: colors.textMuted },
});
