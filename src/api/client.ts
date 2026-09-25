import * as SecureStore from 'expo-secure-store';

// Same backend the web app talks to. Change this if you point the app at a
// different environment (staging, a different school's deployment, etc.).
const BASE_URL = 'https://13-202-93-187.sslip.io/api/v1';

const TOKEN_KEY = 'cd_token';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`).join('&');
}

export const authApi = {
  login: (email: string, password: string) =>
    request<{ user: unknown; token: string }>('/auth/login', { method: 'POST', body: { email, password } }),
};

export const academicApi = {
  listYears: (schoolId: string) => request<{ items: AcademicYear[] }>(`/academic-years${qs({ school_id: schoolId })}`),
};

export const studentsApi = {
  myWards: () => request<{ items: Student[] }>('/my-wards'),
};

export const homeworkApi = {
  wardHomework: (studentId: string, academicYearId: string) =>
    request<{ items: WardHomeworkItem[] }>(`/ward-homework${qs({ student_id: studentId, academic_year_id: academicYearId })}`),
};

export const resultsApi = {
  wardExams: (studentId: string, academicYearId: string) =>
    request<{ items: Exam[] }>(`/ward-exams${qs({ student_id: studentId, academic_year_id: academicYearId })}`),
  getMarksheet: (examId: string, studentId: string) =>
    request<Marksheet>(`/marksheets${qs({ exam_id: examId, student_id: studentId })}`),
};

// ---- Shared types (mirrors the Go backend's JSON shapes) ----

export type AcademicYear = {
  id: string;
  name: string;
  is_current: boolean;
};

export type Student = {
  id: string;
  first_name: string;
  last_name: string;
  student_code: string;
  status: string;
};

export type WardHomeworkItem = {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  submission_status?: string;
};

export type Exam = {
  id: string;
  name: string;
};

export type MarksheetRow = {
  subject_name: string;
  max_marks: number;
  marks_obtained: number;
  is_absent: boolean;
  percentage: number;
  grade: string;
  status: string;
};

export type Marksheet = {
  exam_name: string;
  academic_year: string;
  rows: MarksheetRow[];
  total_obtained: number;
  total_max: number;
  percentage: number;
  result: string;
};
