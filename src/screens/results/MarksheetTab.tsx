import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { resultsApi, Marksheet } from '../../api/client';
import { downloadAndShare } from '../../utils/downloadAndShare';
import { ResultsContext, studentLabel } from './types';
import { Badge, Button, Card, Field, SectionHeader, Select, colors, confirm, showError, styles as ui } from './ui';

/** View/download one student's marksheet for one exam. super_admin can override the total. */
export default function MarksheetTab({ ctx }: { ctx: ResultsContext }) {
  const [examId, setExamId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [marksheet, setMarksheet] = useState<Marksheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalInput, setTotalInput] = useState('');
  const [totalSaving, setTotalSaving] = useState(false);
  const [totalMsg, setTotalMsg] = useState('');

  function clear() {
    setMarksheet(null);
    setEditingTotal(false);
    setTotalMsg('');
  }

  async function load() {
    if (!examId || !studentId) return;
    setLoading(true);
    clear();
    try {
      setMarksheet(await resultsApi.getMarksheet(examId, studentId));
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      const blob = await resultsApi.downloadMarksheet(examId, studentId);
      await downloadAndShare(blob, `marksheet_${marksheet?.student_code || studentId}.pdf`);
    } catch (err) {
      showError(err);
    } finally {
      setDownloading(false);
    }
  }

  async function saveTotal() {
    const value = parseFloat(totalInput);
    if (Number.isNaN(value)) {
      setTotalMsg('Enter a valid number');
      return;
    }
    setTotalSaving(true);
    setTotalMsg('');
    try {
      setMarksheet(await resultsApi.setTotalOverride(examId, studentId, value));
      setEditingTotal(false);
    } catch (err: any) {
      setTotalMsg(err.message);
    } finally {
      setTotalSaving(false);
    }
  }

  async function resetTotal() {
    if (!(await confirm('Reset total?', 'Reset this total back to the auto-calculated value?', 'Reset'))) return;
    setTotalSaving(true);
    setTotalMsg('');
    try {
      setMarksheet(await resultsApi.clearTotalOverride(examId, studentId));
    } catch (err: any) {
      setTotalMsg(err.message);
    } finally {
      setTotalSaving(false);
    }
  }

  return (
    <View>
      <SectionHeader title="Student Marksheet" />
      <Card>
        <Select
          label="Exam"
          value={examId}
          onChange={v => {
            setExamId(v);
            clear();
          }}
          placeholder="Select exam..."
          options={ctx.exams.map(e => ({ label: e.name, value: e.id }))}
        />
        <Select
          label="Student"
          value={studentId}
          onChange={v => {
            setStudentId(v);
            clear();
          }}
          placeholder={ctx.students.length ? 'Select student...' : 'No students in this class'}
          options={ctx.students.map(s => ({ label: studentLabel(s), value: s.id }))}
        />
        <View style={ui.buttonRow}>
          <Button label="View Marksheet" onPress={load} loading={loading} disabled={!examId || !studentId} />
          {marksheet && <Button variant="outline" label="Download PDF" onPress={download} loading={downloading} />}
        </View>
      </Card>

      {marksheet && (
        <Card>
          {marksheet.school_name ? <Text style={s.school}>{marksheet.school_name}</Text> : null}
          <Text style={ui.muted}>
            {marksheet.exam_name} · {marksheet.academic_year}
          </Text>
          <Text style={s.student}>
            {marksheet.student_name} · {marksheet.student_code} · {marksheet.grade_level_name}
          </Text>

          <View style={ui.divider} />

          {(marksheet.rows || []).map((row, i) => (
            <View key={i} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.subject}>{row.subject_name}</Text>
                <Text style={ui.muted}>
                  Max {row.max_marks}
                  {row.passing_marks !== undefined ? ` · Pass ${row.passing_marks}` : ''}
                  {row.is_absent ? '' : ` · ${row.percentage?.toFixed(1)}%`}
                </Text>
                {row.is_co_scholastic && <Text style={ui.muted}>Co-scholastic — not in total</Text>}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={s.obtained}>{row.is_absent ? 'Absent' : row.marks_obtained}</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {row.grade ? <Badge label={row.grade} /> : null}
                  <Badge label={row.status} tone={row.status === 'Pass' ? 'success' : row.status === 'Fail' ? 'danger' : 'muted'} />
                </View>
              </View>
            </View>
          ))}

          <View style={s.totalBox}>
            <Text style={ui.fieldLabel}>TOTAL / RESULT</Text>
            {editingTotal ? (
              <View>
                <View style={[ui.row, { alignItems: 'flex-end' }]}>
                  <Field label={`Total (out of ${marksheet.total_max})`} keyboardType="decimal-pad" value={totalInput} onChangeText={setTotalInput} />
                </View>
                <View style={ui.buttonRow}>
                  <Button small label="Save" onPress={saveTotal} loading={totalSaving} />
                  <Button small variant="outline" label="Cancel" onPress={() => setEditingTotal(false)} disabled={totalSaving} />
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Text style={s.totalValue}>
                  {marksheet.total_obtained?.toFixed(1)} / {marksheet.total_max}
                </Text>
                {marksheet.is_total_overridden && <Badge label={`edited · auto ${marksheet.computed_total_obtained?.toFixed(1) ?? '-'}`} tone="primary" />}
              </View>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
              <Text style={s.percent}>{marksheet.percentage?.toFixed(1)}%</Text>
              {marksheet.overall_grade ? <Badge label={marksheet.overall_grade} /> : null}
              <Badge label={marksheet.result} tone={marksheet.result === 'Pass' ? 'success' : 'danger'} />
              {marksheet.cgpa !== undefined && <Text style={ui.muted}>CGPA {marksheet.cgpa.toFixed(2)}</Text>}
            </View>
            {ctx.isSuperAdmin && !editingTotal && (
              <View style={ui.buttonRow}>
                <Button
                  small
                  variant="outline"
                  label="Edit total"
                  onPress={() => {
                    setTotalInput(String(marksheet.total_obtained));
                    setTotalMsg('');
                    setEditingTotal(true);
                  }}
                />
                {marksheet.is_total_overridden && <Button small variant="outline" label="Reset to auto" onPress={resetTotal} loading={totalSaving} />}
              </View>
            )}
            {totalMsg ? <Text style={{ color: colors.danger, marginTop: 6, fontSize: 13 }}>{totalMsg}</Text> : null}
          </View>
        </Card>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  school: { fontSize: 16, fontWeight: '700', color: colors.text },
  student: { marginTop: 4, fontSize: 14, fontWeight: '600', color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  subject: { fontSize: 14, fontWeight: '600', color: colors.text },
  obtained: { fontSize: 16, fontWeight: '700', color: colors.text },
  totalBox: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: colors.bg },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  percent: { fontSize: 15, fontWeight: '700', color: colors.text },
});
