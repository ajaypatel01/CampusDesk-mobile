import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { resultsApi, ReportCard } from '../../api/client';
import { downloadAndShare } from '../../utils/downloadAndShare';
import { ResultsContext, studentLabel } from './types';
import CustomFieldsSection from './CustomFieldsSection';
import { Badge, Button, Card, Empty, Field, Message, SectionHeader, Select, colors, showError, styles as ui } from './ui';

const ROMAN = ['I', 'II', 'III'];
const DISCIPLINE_GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C'];
const DESIGNS = [
  { value: 'classic', label: 'Classic' },
  { value: 'modern', label: 'Modern Color' },
  { value: 'minimal', label: 'Minimal' },
];
const EMPTY_DETAILS = { roll_no: '', attendance: '', remark: '', promoted_to: '', moral_remark: '', gk_remark: '' };

/** Admin-only: combined multi-exam report card, its details, discipline grades and PDF. */
export default function ReportCardTab({ ctx }: { ctx: ResultsContext }) {
  const [studentId, setStudentId] = useState('');
  const [rc, setRc] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [criteria, setCriteria] = useState<string[]>([]);
  const [discipline, setDiscipline] = useState<Record<string, string>>({});
  const [design, setDesign] = useState('classic');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    resultsApi
      .listDisciplineCriteria()
      .then(r => setCriteria(r.items || []))
      .catch(() => setCriteria([]));
  }, []);

  async function load() {
    if (!studentId) return;
    setLoading(true);
    setRc(null);
    setError('');
    setMsg('');
    try {
      const res = await resultsApi.getReportCard(studentId, ctx.year.id);
      // The backend sends null (not []) for exams/subjects when nothing is published yet.
      setRc({ ...res, exams: res.exams || [], subjects: (res.subjects || []).map(sub => ({ ...sub, by_exam: sub.by_exam || [] })) });
      setDetails({
        roll_no: res.details?.roll_no || '',
        attendance: res.details?.attendance || '',
        remark: res.details?.remark || '',
        promoted_to: res.details?.promoted_to || '',
        moral_remark: res.details?.moral_remark || '',
        gk_remark: res.details?.gk_remark || '',
      });
      const grades: Record<string, string> = {};
      (res.discipline_grades || []).forEach(dg => {
        grades[dg.criterion_key] = dg.grade;
      });
      setDiscipline(grades);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      const blob = await resultsApi.downloadReportCard(studentId, ctx.year.id, design);
      await downloadAndShare(blob, `report_card_${rc?.student_code || studentId}.pdf`);
    } catch (err) {
      showError(err);
    } finally {
      setDownloading(false);
    }
  }

  async function saveDetails() {
    if (!rc) return;
    setSaving(true);
    setMsg('');
    try {
      await resultsApi.upsertReportCardDetails({
        school_id: ctx.schoolId,
        academic_year_id: ctx.year.id,
        grade_level_id: rc.grade_level_id,
        student_id: studentId,
        ...details,
      });
      setMsg('Saved.');
    } catch (err: any) {
      setMsg('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveDiscipline() {
    if (!rc) return;
    setSaving(true);
    setMsg('');
    try {
      await resultsApi.upsertDisciplineGrades({ school_id: ctx.schoolId, academic_year_id: ctx.year.id, student_id: studentId, grades: discipline });
      setMsg('Discipline grades saved.');
    } catch (err: any) {
      setMsg('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const exams = rc?.exams || [];

  return (
    <View>
      <SectionHeader title="Report Card" />
      <Card>
        <Select
          label="Student"
          value={studentId}
          onChange={v => {
            setStudentId(v);
            setRc(null);
            setError('');
            setMsg('');
          }}
          placeholder={ctx.students.length ? 'Select student...' : 'No students in this class'}
          options={ctx.students.map(s => ({ label: studentLabel(s), value: s.id }))}
        />
        <Button label="View Report Card" onPress={load} loading={loading} disabled={!studentId} />
        {rc && (
          <View style={{ marginTop: 12 }}>
            <Select label="PDF design (only changes the look)" value={design} onChange={setDesign} options={DESIGNS} />
            <Button variant="outline" label="Download PDF" onPress={download} loading={downloading} />
          </View>
        )}
      </Card>

      {error ? <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}

      {rc && (
        <>
          <Card>
            <Text style={s.school}>{rc.school_name}</Text>
            <Text style={ui.muted}>
              {rc.academic_year} · {rc.grade_level_name} ({rc.template})
            </Text>
            <Text style={s.student}>
              {rc.student_name} · {rc.student_code}
            </Text>
          </Card>

          {exams.length === 0 ? (
            <Empty text="No published exam results yet for this student -- publish an exam under the Exams tab once marks are entered." />
          ) : (
            <>
              {(rc.subjects || []).map(sub => (
                <Card key={sub.subject_id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[s.subject, { flex: 1 }]}>{sub.subject_name}</Text>
                    {sub.grade ? <Badge label={sub.grade} /> : null}
                  </View>
                  {sub.is_co_scholastic && <Text style={ui.muted}>Co-scholastic — not in total</Text>}
                  {(sub.by_exam || []).map((cell, i) => (
                    <View key={i} style={s.examLine}>
                      <Text style={s.examName}>
                        {exams[i]?.exam_name} ({ROMAN[(exams[i]?.position ?? 0) - 1] || exams[i]?.position})
                      </Text>
                      <Text style={s.examValue}>{cell.is_absent ? 'Absent' : `${cell.obtained} / ${cell.max_marks}`}</Text>
                    </View>
                  ))}
                  <View style={[s.examLine, { borderBottomWidth: 0 }]}>
                    <Text style={[s.examName, { fontWeight: '700', color: colors.text }]}>Overall</Text>
                    <Text style={[s.examValue, { fontWeight: '700' }]}>
                      {sub.overall_obtained} / {sub.overall_max} · {sub.overall_percent?.toFixed(1)}%
                    </Text>
                  </View>
                </Card>
              ))}
              <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
                <Text style={ui.fieldLabel}>GRAND TOTAL</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={s.grand}>
                    {rc.overall_obtained} / {rc.overall_max}
                  </Text>
                  <Text style={s.subject}>{rc.overall_percent?.toFixed(1)}%</Text>
                  {rc.overall_grade ? <Badge label={rc.overall_grade} tone="primary" /> : null}
                </View>
              </Card>
            </>
          )}

          <SectionHeader title="Report Card Details" />
          <Card>
            <View style={ui.row}>
              <Field label="Roll No." value={details.roll_no} onChangeText={roll_no => setDetails({ ...details, roll_no })} />
              <Field label="Attendance" placeholder="e.g. 210/220" value={details.attendance} onChangeText={attendance => setDetails({ ...details, attendance })} />
            </View>
            <Field label="Promoted To" value={details.promoted_to} onChangeText={promoted_to => setDetails({ ...details, promoted_to })} />
            <Field label="Remark" multiline value={details.remark} onChangeText={remark => setDetails({ ...details, remark })} />
            {rc.template === 'primary' && (
              <View style={ui.row}>
                <Field label="Moral" value={details.moral_remark} onChangeText={moral_remark => setDetails({ ...details, moral_remark })} />
                <Field label="G.K." value={details.gk_remark} onChangeText={gk_remark => setDetails({ ...details, gk_remark })} />
              </View>
            )}
            <Button label="Save Details" onPress={saveDetails} loading={saving} />
          </Card>

          {rc.template === 'middle' && (
            <>
              <SectionHeader title="Co-Scholastic / Discipline Grades" />
              <Card>
                {criteria.length === 0 ? (
                  <Empty text="No discipline criteria set up." />
                ) : (
                  criteria.map(key => (
                    <Select
                      key={key}
                      label={key}
                      value={discipline[key] || ''}
                      onChange={v => setDiscipline(prev => ({ ...prev, [key]: v }))}
                      placeholder="-"
                      options={DISCIPLINE_GRADES.map(g => ({ label: g, value: g }))}
                    />
                  ))
                )}
                <Button label="Save Discipline Grades" onPress={saveDiscipline} loading={saving} disabled={criteria.length === 0} />
              </Card>
            </>
          )}

          <Message text={msg} />

          {ctx.isSuperAdmin && (
            <CustomFieldsSection entityType="student_result" entityId={studentId} scopeId={ctx.year.id} schoolId={ctx.schoolId} title="Extra Result Fields" />
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  school: { fontSize: 16, fontWeight: '700', color: colors.text },
  student: { marginTop: 4, fontSize: 14, fontWeight: '600', color: colors.text },
  subject: { fontSize: 15, fontWeight: '700', color: colors.text },
  examLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 8,
  },
  examName: { fontSize: 13, color: colors.textMuted, flex: 1 },
  examValue: { fontSize: 13, color: colors.text },
  grand: { fontSize: 20, fontWeight: '800', color: colors.text },
});
