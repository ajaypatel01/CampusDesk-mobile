import { useState } from 'react';
import { View, Text } from 'react-native';
import { resultsApi, Exam } from '../../api/client';
import { ResultsContext } from './types';
import ExamFormatEditor from './ExamFormatEditor';
import { Badge, Button, Card, Empty, Field, SectionHeader, colors, confirm, showError, styles as ui } from './ui';

const EMPTY_FORM = { name: '', exam_date: '', weight_percent: '100' };

/** Admin-only: exams for the selected grade + year, and publishing them to parents. */
export default function ExamsTab({ ctx }: { ctx: ResultsContext }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const dateInvalid = form.exam_date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(form.exam_date);

  async function addExam() {
    if (!form.name.trim() || dateInvalid) return;
    setSaving(true);
    try {
      await resultsApi.createExam({
        school_id: ctx.schoolId,
        academic_year_id: ctx.year.id,
        grade_level_id: ctx.gradeId,
        name: form.name.trim(),
        exam_date: form.exam_date || undefined,
        weight_percent: parseInt(form.weight_percent, 10) || 100,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      ctx.reloadExams();
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  }

  // Publishing makes an exam's marks visible to parents and on report cards;
  // unpublishing hides them again without deleting anything.
  async function togglePublish(exam: Exam) {
    const next = !exam.is_published;
    if (next && !(await confirm('Publish exam?', `Publish "${exam.name}"? Parents will be able to see marks recorded against it.`, 'Publish'))) return;
    setPublishingId(exam.id);
    try {
      await resultsApi.publishExam(exam.id, next);
      ctx.reloadExams();
    } catch (err) {
      showError(err);
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <View>
      <SectionHeader title="Exams" action={!showForm && <Button small label="+ Add Exam" onPress={() => setShowForm(true)} />} />

      {showForm && (
        <Card>
          <Field label="Exam name *" placeholder="e.g. Unit Test 1" value={form.name} onChangeText={name => setForm({ ...form, name })} />
          <View style={ui.row}>
            <Field
              label="Exam date (YYYY-MM-DD)"
              placeholder="2026-11-15"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              value={form.exam_date}
              onChangeText={exam_date => setForm({ ...form, exam_date })}
            />
            <View style={{ width: 100 }}>
              <Field label="Weight %" keyboardType="number-pad" maxLength={3} value={form.weight_percent} onChangeText={weight_percent => setForm({ ...form, weight_percent })} />
            </View>
          </View>
          {dateInvalid && <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 8 }}>Use the format YYYY-MM-DD, or leave it empty.</Text>}
          <View style={ui.buttonRow}>
            <Button label="Save" onPress={addExam} loading={saving} disabled={!form.name.trim() || dateInvalid} />
            <Button variant="outline" label="Cancel" onPress={() => setShowForm(false)} />
          </View>
        </Card>
      )}

      {ctx.exams.length === 0 ? (
        <Empty text="No exams yet" />
      ) : (
        ctx.exams.map(ex => (
          <Card key={ex.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{ex.name}</Text>
                <Text style={[ui.muted, { marginTop: 2 }]}>
                  {ex.exam_date ? new Date(ex.exam_date).toLocaleDateString('en-IN') : 'No date'} · Weight {ex.weight_percent ?? 100}%
                </Text>
                <View style={{ marginTop: 6 }}>
                  <Badge label={ex.is_published ? 'Published' : 'Draft'} tone={ex.is_published ? 'success' : 'muted'} />
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <Button
                  small
                  variant="outline"
                  label={ex.is_published ? 'Unpublish' : 'Publish'}
                  loading={publishingId === ex.id}
                  onPress={() => togglePublish(ex)}
                />
                <Button
                  small
                  variant={ctx.formatExamId === ex.id ? 'primary' : 'outline'}
                  label="Marks format"
                  onPress={() => ctx.openExamFormat(ctx.formatExamId === ex.id ? null : ex.id)}
                />
              </View>
            </View>
            {ctx.formatExamId === ex.id && (
              <View style={{ marginTop: 12 }}>
                <View style={ui.divider} />
                <Text style={[ui.sectionTitle, { marginBottom: 8 }]}>Marks format</Text>
                <ExamFormatEditor exam={ex} />
              </View>
            )}
          </Card>
        ))
      )}
    </View>
  );
}
