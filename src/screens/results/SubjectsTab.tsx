import { useState } from 'react';
import { View, Text, Switch } from 'react-native';
import { resultsApi } from '../../api/client';
import { ResultsContext } from './types';
import MarkFieldsEditor from './MarkFieldsEditor';
import { Badge, Button, Card, Empty, Field, SectionHeader, colors, confirm, showError, styles as ui } from './ui';

const EMPTY_FORM = { name: '', code: '', max_marks: '100', passing_marks: '33', sort_order: '0', is_co_scholastic: false };

/** Admin-only: subjects for the selected grade and their mark fields. */
export default function SubjectsTab({ ctx }: { ctx: ResultsContext }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function addSubject() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await resultsApi.createSubject({
        school_id: ctx.schoolId,
        grade_level_id: ctx.gradeId,
        name: form.name.trim(),
        code: form.code.trim(),
        max_marks: parseInt(form.max_marks, 10) || 100,
        passing_marks: parseInt(form.passing_marks, 10) || 33,
        sort_order: parseInt(form.sort_order, 10) || 0,
        is_co_scholastic: form.is_co_scholastic,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      ctx.reloadSubjects();
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubject(id: string, name: string) {
    if (!(await confirm('Delete subject?', `Delete ${name}? Marks entered for it will no longer show.`, 'Delete', true))) return;
    try {
      await resultsApi.deleteSubject(id);
      ctx.reloadSubjects();
    } catch (err) {
      showError(err);
    }
  }

  return (
    <View>
      <SectionHeader
        title={`Subjects for ${ctx.gradeName || '—'}`}
        action={!showForm && <Button small label="+ Add Subject" onPress={() => setShowForm(true)} />}
      />

      {showForm && (
        <Card>
          <View style={ui.row}>
            <Field label="Name *" placeholder="e.g. Mathematics" value={form.name} onChangeText={name => setForm({ ...form, name })} />
            <View style={{ width: 110 }}>
              <Field label="Code" placeholder="MATH" autoCapitalize="characters" value={form.code} onChangeText={code => setForm({ ...form, code })} />
            </View>
          </View>
          <View style={ui.row}>
            <Field label="Max marks" keyboardType="number-pad" value={form.max_marks} onChangeText={max_marks => setForm({ ...form, max_marks })} />
            <Field label="Passing" keyboardType="number-pad" value={form.passing_marks} onChangeText={passing_marks => setForm({ ...form, passing_marks })} />
            <Field label="Sort order" keyboardType="number-pad" value={form.sort_order} onChangeText={sort_order => setForm({ ...form, sort_order })} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Switch value={form.is_co_scholastic} onValueChange={is_co_scholastic => setForm({ ...form, is_co_scholastic })} trackColor={{ true: colors.primary }} />
            <Text style={{ flex: 1, fontSize: 13, color: colors.text }}>Co-scholastic / grading subject (graded, but not counted in the overall total)</Text>
          </View>
          <View style={ui.buttonRow}>
            <Button label="Save" onPress={addSubject} loading={saving} disabled={!form.name.trim()} />
            <Button variant="outline" label="Cancel" onPress={() => setShowForm(false)} />
          </View>
        </Card>
      )}

      {ctx.subjects.length === 0 ? (
        <Empty text="No subjects yet" />
      ) : (
        ctx.subjects.map(sub => (
          <Card key={sub.id}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                  {sub.name}
                  {sub.code ? <Text style={ui.muted}> ({sub.code})</Text> : null}
                </Text>
                <Text style={[ui.muted, { marginTop: 2 }]}>
                  Max {sub.max_marks} · Pass {sub.passing_marks}
                </Text>
                {sub.is_co_scholastic && (
                  <View style={{ marginTop: 4 }}>
                    <Badge label="Grading only" />
                  </View>
                )}
              </View>
              <Button small variant="danger" label="Delete" onPress={() => deleteSubject(sub.id, sub.name)} />
            </View>
            <View style={ui.divider} />
            <Text style={[ui.fieldLabel, { marginBottom: 6 }]}>CUSTOM FIELDS</Text>
            <MarkFieldsEditor subject={sub} onChanged={ctx.reloadSubjects} />
          </Card>
        ))
      )}
    </View>
  );
}
