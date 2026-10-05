import { AcademicYear, Exam, Student, Subject } from '../../api/client';

/** Everything the Results tabs share, loaded once by ResultsScreen for the selected grade. */
export type ResultsContext = {
  schoolId: string;
  year: AcademicYear;
  gradeId: string;
  gradeName: string;
  isTeacher: boolean;
  isSuperAdmin: boolean;
  subjects: Subject[];
  exams: Exam[];
  students: Student[];
  reloadSubjects: () => void;
  reloadExams: () => void;
};

export function studentLabel(s: Student) {
  return `${s.first_name} ${s.last_name} (${s.student_code})`;
}
