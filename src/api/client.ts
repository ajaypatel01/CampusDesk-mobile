import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Same backend the web app talks to. Change this if you point the app at a
// different environment (staging, a different school's deployment, etc.).
const BASE_URL = 'https://13-202-93-187.sslip.io/api/v1';

const TOKEN_KEY = 'cd_token';

// expo-secure-store has no web implementation (there's no OS keychain in a browser).
// The real targets for this app are iOS/Android, where SecureStore backs onto the
// platform keychain/keystore; localStorage here is only so `expo start --web` (used
// for quick previews) doesn't crash — it's never how the shipped app stores the token.
export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return window.localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// This project's lint config doesn't flag `any`, and a fully-typed client for ~90
// loosely-shaped backend endpoints isn't worth the ceremony — screens narrow what they need.
type Json = any;

type RequestOptions = {
  method?: string;
  body?: Json;
};

async function request<T = Json>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    await clearToken();
    throw new ApiError('Session expired. Please log in again.', 401);
  }
  if (res.status === 204) {
    return null as T;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed: ${res.status}`, res.status);
  }
  return data as T;
}

/** For endpoints that return a raw file (PDF, receipt, etc.) rather than JSON. */
async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) {
    await clearToken();
    throw new ApiError('Session expired. Please log in again.', 401);
  }
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`;
    try {
      const d = await res.json();
      if (d.error) msg = d.error;
    } catch {
      // response wasn't JSON; keep the generic message
    }
    throw new ApiError(msg, res.status);
  }
  return res.blob();
}

function qs(params: Record<string, string | number | boolean | undefined | null> = {}): string {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ---- API groups (1:1 port of the web app's src/services/api.js) ----

export const schoolsApi = {
  list: (params: Json = {}) => request(`/schools${qs(params)}`),
  get: (id: string) => request(`/schools/${id}`),
  create: (body: Json) => request('/schools', { method: 'POST', body }),
  update: (id: string, body: Json) => request(`/schools/${id}`, { method: 'PUT', body }),
  remove: (id: string) => request(`/schools/${id}`, { method: 'DELETE' }),
  publicList: () => request('/schools/public'),
};

export const studentsApi = {
  list: (params: Json) => request(`/students${qs(params)}`),
  get: (id: string) => request<Student>(`/students/${id}`),
  create: (body: Json) => request('/students', { method: 'POST', body }),
  update: (id: string, body: Json) => request(`/students/${id}`, { method: 'PUT', body }),
  remove: (id: string) => request(`/students/${id}`, { method: 'DELETE' }),
  myWards: () => request<{ items: Student[] }>('/my-wards'),
};

export const guardiansApi = {
  list: (studentId: string) => request(`/guardians${qs({ student_id: studentId })}`),
  get: (id: string) => request(`/guardians/${id}`),
  create: (body: Json) => request('/guardians', { method: 'POST', body }),
  link: (body: Json) => request('/guardians/link', { method: 'POST', body }),
};

export const usersApi = {
  list: (params: Json = {}) => request(`/users${qs(params)}`),
  get: (id: string) => request(`/users/${id}`),
  create: (body: Json) => request('/users', { method: 'POST', body }),
  update: (id: string, body: Json) => request(`/users/${id}`, { method: 'PUT', body }),
  remove: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
  login: (email: string, password: string) => request<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (body: Json) => request('/auth/register', { method: 'POST', body }),
  listPending: (params: Json = {}) => request(`/users${qs({ ...params, status: 'pending' })}`),
  approve: (id: string) => request(`/users/${id}/approve`, { method: 'POST' }),
  reject: (id: string) => request(`/users/${id}/reject`, { method: 'POST' }),
};

export const academicApi = {
  listYears: (schoolId: string) => request<{ items: AcademicYear[] }>(`/academic-years${qs({ school_id: schoolId })}`),
  createYear: (body: Json) => request('/academic-years', { method: 'POST', body }),
  listGrades: (schoolId: string) => request<{ items: GradeLevel[] }>(`/grade-levels${qs({ school_id: schoolId })}`),
  createGrade: (body: Json) => request('/grade-levels', { method: 'POST', body }),
  listSections: (params: Json) => request(`/class-sections${qs(params)}`),
  createSection: (body: Json) => request('/class-sections', { method: 'POST', body }),
};

export const enrollmentsApi = {
  list: (params: Json) => request(`/enrollments${qs(params)}`),
  get: (id: string) => request(`/enrollments/${id}`),
  create: (body: Json) => request('/enrollments', { method: 'POST', body }),
  update: (id: string, body: Json) => request(`/enrollments/${id}`, { method: 'PUT', body }),
};

export const attendanceApi = {
  list: (params: Json) => request(`/attendance${qs(params)}`),
  record: (body: Json) => request('/attendance', { method: 'POST', body }),
};

export const feesApi = {
  listStructures: (params: Json) => request(`/fee-structures${qs(params)}`),
  getStructure: (id: string) => request(`/fee-structures/${id}`),
  createStructure: (body: Json) => request('/fee-structures', { method: 'POST', body }),
  updateStructure: (id: string, body: Json) => request(`/fee-structures/${id}`, { method: 'PUT', body }),

  listAccounts: (params: Json) => request(`/fee-accounts${qs(params)}`),
  getAccount: (id: string) => request(`/fee-accounts/${id}`),
  createAccount: (body: Json) => request('/fee-accounts', { method: 'POST', body }),
  updateAccount: (id: string, body: Json) => request(`/fee-accounts/${id}`, { method: 'PUT', body }),

  listPayments: (accountId: string) => request(`/fee-payments${qs({ student_fee_account_id: accountId })}`),
  recordPayment: (body: Json) => request('/fee-payments', { method: 'POST', body }),
  voidPayment: (id: string) => request(`/fee-payments/${id}`, { method: 'DELETE' }),

  schoolSummary: (params: Json) => request(`/fee-summary${qs(params)}`),
  studentSummary: (studentId: string, yearId: string) => request<FeeSummary>(`/fee-summary/student/${studentId}${qs({ academic_year_id: yearId })}`),
  installmentSheet: (params: Json) => request(`/fee-installment-sheet${qs(params)}`),
  downloadReceipt: (paymentId: string) => requestBlob(`/fee-receipts/${paymentId}`),
  sendReceiptWhatsApp: (paymentId: string, phone: string) => request(`/fee-receipts/${paymentId}/whatsapp`, { method: 'POST', body: { phone } }),
};

export const documentsApi = {
  downloadBonafide: (studentId: string, yearId: string) => requestBlob(`/documents/bonafide?student_id=${studentId}&academic_year_id=${yearId}`),
  emailBonafide: (body: Json) => request('/documents/bonafide/email', { method: 'POST', body }),
  whatsappBonafide: (body: Json) => request('/documents/bonafide/whatsapp', { method: 'POST', body }),

  downloadTC: (params: Record<string, string>) => requestBlob(`/documents/transfer-certificate?${new URLSearchParams(params)}`),
  emailTC: (body: Json) => request('/documents/transfer-certificate/email', { method: 'POST', body }),
  whatsappTC: (body: Json) => request('/documents/transfer-certificate/whatsapp', { method: 'POST', body }),

  downloadSalarySlip: (body: Json) => requestBlob('/documents/salary-slip', { method: 'POST', body }),
  emailSalarySlip: (body: Json) => request('/documents/salary-slip/email', { method: 'POST', body }),
  whatsappSalarySlip: (body: Json) => request('/documents/salary-slip/whatsapp', { method: 'POST', body }),
};

export const resultsApi = {
  listSubjects: (params: Json) => request<{ items: Subject[] }>(`/subjects${qs(params)}`),
  createSubject: (body: Json) => request('/subjects', { method: 'POST', body }),
  updateSubject: (id: string, body: Json) => request(`/subjects/${id}`, { method: 'PUT', body }),
  deleteSubject: (id: string) => request(`/subjects/${id}`, { method: 'DELETE' }),

  // Per-subject graded fields (Oral/Written/...). Adding/editing/removing them is
  // admin subject setup -- the backend blocks teachers and parents.
  listSubjectComponents: (subjectId: string) => request(`/subjects/${subjectId}/mark-components`),
  addSubjectComponent: (subjectId: string, body: Json) => request(`/subjects/${subjectId}/mark-components`, { method: 'POST', body }),
  // Rename a field and/or change its max marks (refused once marks are recorded under it).
  updateSubjectComponent: (subjectId: string, key: string, body: Json) =>
    request(`/subjects/${subjectId}/mark-components/${key}`, { method: 'PUT', body }),
  deleteSubjectComponent: (subjectId: string, key: string) => request(`/subjects/${subjectId}/mark-components/${key}`, { method: 'DELETE' }),

  listExams: (params: Json) => request<{ items: Exam[] }>(`/exams${qs(params)}`),
  createExam: (body: Json) => request('/exams', { method: 'POST', body }),
  publishExam: (id: string, publish: boolean) => request(`/exams/${id}/publish`, { method: 'POST', body: { publish } }),
  // Per-exam marks distribution for each subject (admins change it; teachers read it).
  listExamFormats: (examId: string) => request<{ items: ExamSubjectFormat[] }>(`/exams/${examId}/mark-formats`),
  setExamSubjectFormat: (examId: string, subjectId: string, components: MarkComponent[]) =>
    request<{ items: ExamSubjectFormat[] }>(`/exams/${examId}/mark-formats/${subjectId}`, { method: 'PUT', body: { components } }),
  resetExamSubjectFormat: (examId: string, subjectId: string) =>
    request<{ items: ExamSubjectFormat[] }>(`/exams/${examId}/mark-formats/${subjectId}`, { method: 'DELETE' }),

  upsertMark: (body: Json) => request('/exam-marks', { method: 'POST', body }),
  bulkUpsertMarks: (marks: Json[]) => request('/exam-marks/bulk', { method: 'POST', body: { marks } }),

  getMarksheet: (examId: string, studentId: string) => request<Marksheet>(`/marksheets${qs({ exam_id: examId, student_id: studentId })}`),
  downloadMarksheet: (examId: string, studentId: string) => requestBlob(`/marksheets/pdf?exam_id=${examId}&student_id=${studentId}`),
  // super_admin only: manually correct a marksheet's total.
  setTotalOverride: (examId: string, studentId: string, totalObtained: number) =>
    request<Marksheet>('/marksheets/total-override', { method: 'PUT', body: { exam_id: examId, student_id: studentId, total_obtained: totalObtained } }),
  clearTotalOverride: (examId: string, studentId: string) =>
    request<Marksheet>(`/marksheets/total-override${qs({ exam_id: examId, student_id: studentId })}`, { method: 'DELETE' }),
  wardExams: (studentId: string, academicYearId: string) => request<{ items: Exam[] }>(`/ward-exams${qs({ student_id: studentId, academic_year_id: academicYearId })}`),

  // Combined, multi-exam, class-wise-templated report card (kg/primary/middle).
  getReportCard: (studentId: string, academicYearId: string) =>
    request<ReportCard>(`/report-cards${qs({ student_id: studentId, academic_year_id: academicYearId })}`),
  // design is a visual skin only ('classic' | 'modern' | 'minimal').
  downloadReportCard: (studentId: string, academicYearId: string, design: string) =>
    requestBlob(`/report-cards/pdf${qs({ student_id: studentId, academic_year_id: academicYearId, design })}`),
  upsertReportCardDetails: (body: Json) => request('/report-cards/details', { method: 'PUT', body }),
  upsertDisciplineGrades: (body: Json) => request('/report-cards/discipline-grades', { method: 'PUT', body }),
  listDisciplineCriteria: () => request<{ items: string[] }>('/discipline-criteria'),
};

// Super-admin-only custom fields. Every call 403s for anyone else.
export const customFieldsApi = {
  createDefinition: (body: Json) => request('/custom-fields/definitions', { method: 'POST', body }),
  deleteDefinition: (id: string) => request(`/custom-fields/definitions/${id}`, { method: 'DELETE' }),
  listValues: (schoolId: string, entityType: string, entityId: string, scopeId?: string) =>
    request<{ items: CustomFieldValue[] }>(`/custom-fields/values${qs({ school_id: schoolId, entity_type: entityType, entity_id: entityId, scope_id: scopeId })}`),
  upsertValue: (body: Json) => request('/custom-fields/values', { method: 'PUT', body }),
};

export const homeworkApi = {
  list: (params: Json) => request(`/homework${qs(params)}`),
  get: (id: string) => request(`/homework/${id}`),
  create: (body: Json) => request('/homework', { method: 'POST', body }),
  remove: (id: string) => request(`/homework/${id}`, { method: 'DELETE' }),
  listSubmissions: (id: string) => request(`/homework/${id}/submissions`),
  upsertSubmission: (id: string, body: Json) => request(`/homework/${id}/submissions`, { method: 'POST', body }),
  studentTracker: (params: Json) => request(`/homework-tracker${qs(params)}`),
  wardHomework: (studentId: string, academicYearId: string) =>
    request<{ items: WardHomeworkItem[] }>(`/ward-homework${qs({ student_id: studentId, academic_year_id: academicYearId })}`),
};

export const idCardsApi = {
  generateStudents: (body: Json) => requestBlob('/id-cards/students', { method: 'POST', body }),
  generateTeachers: (body: Json) => requestBlob('/id-cards/teachers', { method: 'POST', body }),
};

export const payrollApi = {
  computeMonth: (params: Json) => request(`/payroll${qs(params)}`),
  downloadSlip: (params: Json) => requestBlob(`/payroll/slip${qs(params)}`),
  listLeaves: (params: Json) => request(`/staff-leaves${qs(params)}`),
  createLeave: (body: Json) => request('/staff-leaves', { method: 'POST', body }),
  updateLeave: (id: string, body: Json) => request(`/staff-leaves/${id}`, { method: 'PUT', body }),
  removeLeave: (id: string) => request(`/staff-leaves/${id}`, { method: 'DELETE' }),
};

export const broadcastsApi = {
  list: (schoolId: string) => request(`/broadcasts${qs({ school_id: schoolId })}`),
  send: (body: Json) => request('/broadcasts', { method: 'POST', body }),
  listRecipients: (id: string) => request(`/broadcasts/${id}/recipients`),
};

export const vansApi = {
  list: (schoolId: string) => request(`/vans${qs({ school_id: schoolId })}`),
  get: (id: string, params: Json = {}) => request(`/vans/${id}${qs(params)}`),
  create: (body: Json) => request('/vans', { method: 'POST', body }),
  update: (id: string, body: Json) => request(`/vans/${id}`, { method: 'PUT', body }),
  remove: (id: string) => request(`/vans/${id}`, { method: 'DELETE' }),
  addRoute: (vanId: string, body: Json) => request(`/vans/${vanId}/routes`, { method: 'POST', body }),
  removeRoute: (vanId: string, routeId: string) => request(`/vans/${vanId}/routes/${routeId}`, { method: 'DELETE' }),
  listAssignments: (params: Json) => request(`/van-assignments${qs(params)}`),
  assignStudent: (body: Json) => request('/van-assignments', { method: 'POST', body }),
  removeAssignment: (id: string) => request(`/van-assignments/${id}`, { method: 'DELETE' }),
};

export const rteApi = {
  getSummary: (params: Json) => request(`/rte/summary${qs(params)}`),
  listStudents: (params: Json) => request(`/rte/students${qs(params)}`),
  listQuotas: (params: Json) => request(`/rte/quotas${qs(params)}`),
  upsertQuota: (body: Json) => request('/rte/quotas', { method: 'POST', body }),
  removeQuota: (id: string) => request(`/rte/quotas/${id}`, { method: 'DELETE' }),
};

export const booksApi = {
  listBooks: (params: Json) => request(`/books${qs(params)}`),
  getBook: (id: string) => request(`/books/${id}`),
  createBook: (body: Json) => request('/books', { method: 'POST', body }),
  updateBook: (id: string, body: Json) => request(`/books/${id}`, { method: 'PUT', body }),
  removeBook: (id: string) => request(`/books/${id}`, { method: 'DELETE' }),
  listBookLists: (params: Json) => request(`/book-lists${qs(params)}`),
  getBookList: (id: string) => request(`/book-lists/${id}`),
  createBookList: (body: Json) => request('/book-lists', { method: 'POST', body }),
  addItem: (listId: string, body: Json) => request(`/book-lists/${listId}/items`, { method: 'POST', body }),
  removeItem: (listId: string, itemId: string) => request(`/book-lists/${listId}/items/${itemId}`, { method: 'DELETE' }),
  downloadPDF: (listId: string) => requestBlob(`/book-lists/${listId}/pdf`),
  listReceipts: (bookListId: string) => request(`/book-receipts${qs({ book_list_id: bookListId })}`),
  recordReceipt: (body: Json) => request('/book-receipts', { method: 'POST', body }),
};

export const configApi = {
  get: () => request<{ whatsapp_enabled: boolean }>('/config'),
};

export const tcRecordsApi = {
  list: (params: Json = {}) => request(`/tc-records${qs(params)}`),
  get: (id: string) => request(`/tc-records/${id}`),
  create: (body: Json) => request('/tc-records', { method: 'POST', body }),
  update: (id: string, body: Json) => request(`/tc-records/${id}`, { method: 'PUT', body }),
  remove: (id: string) => request(`/tc-records/${id}`, { method: 'DELETE' }),
};

export const vouchersApi = {
  list: (params: Json = {}) => request(`/vouchers${qs(params)}`),
  create: (body: Json) => request('/vouchers', { method: 'POST', body }),
};

export const staffApi = {
  list: (params: Json = {}) => request(`/staff${qs(params)}`),
  get: (id: string) => request(`/staff/${id}`),
  upsertProfile: (id: string, body: Json) => request(`/staff/${id}/profile`, { method: 'PUT', body }),
};

// ---- Shared types (mirrors the Go backend's JSON shapes; kept loose/partial on
// purpose — screens narrow further as they need specific fields) ----

export type LoginResponse = { user: Json; token: string };

export type AcademicYear = { id: string; name: string; is_current: boolean };
export type GradeLevel = { id: string; name: string; sort_order: number };

export type Student = {
  id: string;
  first_name: string;
  last_name: string;
  student_code: string;
  status: string;
  [key: string]: Json;
};

export type WardHomeworkItem = {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  submission_status?: string;
};

export type Exam = { id: string; name: string; exam_date?: string | null; weight_percent?: number; is_published?: boolean };

export type ClassSection = { id: string; grade_level_id: string; name: string; homeroom_teacher_id?: string | null };

export type MarkComponent = { key: string; label: string; max_marks: number };

/** One subject's fields in one exam; custom = the exam has its own format for it. */
export type ExamSubjectFormat = {
  subject_id: string;
  subject_name: string;
  max_marks: number;
  components: MarkComponent[];
  custom: boolean;
};

export type Subject = {
  id: string;
  name: string;
  code?: string;
  max_marks: number;
  passing_marks: number;
  sort_order?: number;
  is_co_scholastic?: boolean;
  mark_components?: MarkComponent[] | null;
};

export type ReportCardCell = { obtained: number; max_marks: number; is_absent?: boolean; grade_letter?: string };

export type ReportCard = {
  school_name: string;
  academic_year: string;
  grade_level_id: string;
  grade_level_name: string;
  template: string;
  student_name: string;
  student_code: string;
  exams: { exam_id: string; exam_name: string; position: number }[] | null;
  subjects:
    | {
        subject_id: string;
        subject_name: string;
        is_co_scholastic?: boolean;
        is_graded?: boolean;
        by_exam: ReportCardCell[] | null;
        overall_obtained: number;
        overall_max: number;
        overall_percent: number;
        grade?: string;
      }[]
    | null;
  overall_obtained: number;
  overall_max: number;
  overall_percent: number;
  overall_grade?: string;
  details?: { roll_no?: string; attendance?: string; remark?: string; promoted_to?: string; moral_remark?: string; gk_remark?: string } | null;
  discipline_grades?: { criterion_key: string; grade: string }[] | null;
};

export type CustomFieldValue = {
  id: string;
  label: string;
  field_type: 'string' | 'int' | 'float' | 'boolean' | 'enum';
  enum_options?: string[] | null;
  value?: string | null;
};

export type MarksheetRow = {
  subject_name: string;
  max_marks: number;
  marks_obtained: number;
  is_absent: boolean;
  percentage: number;
  passing_marks?: number;
  grade: string;
  status: string;
  is_co_scholastic?: boolean;
  /** A/B/C/D for a grading-only subject graded instead of marked. */
  grade_letter?: string;
};

export type Marksheet = {
  exam_name: string;
  academic_year: string;
  student_name: string;
  student_code: string;
  grade_level_name: string;
  rows: MarksheetRow[];
  total_obtained: number;
  total_max: number;
  percentage: number;
  result: string;
  school_name?: string;
  cgpa?: number;
  overall_grade?: string;
  is_total_overridden?: boolean;
  computed_total_obtained?: number;
};

export type FeePayment = {
  id: string;
  fee_type: string;
  installment_number?: number | null;
  amount: number;
  payment_date: string;
  payment_mode: string;
  reference_number?: string;
  notes?: string;
};

export type FeeSummary = {
  account_id: string;
  student_id: string;
  student_name: string;
  student_code: string;
  grade_level_name: string;
  tuition_fee: number;
  discount_amount: number;
  net_tuition_fee: number;
  van_fee: number;
  previous_year_dues: number;
  is_rte: boolean;
  total_due: number;
  total_paid: number;
  balance_remaining: number;
  payments: FeePayment[];
};
