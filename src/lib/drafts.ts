import { t } from "@/lib/i18n";
import type { AppState, Course, Profile, Semester, SemesterSeason } from "@/types";

export type CourseDraft = {
  code: string;
  name: string;
  credits: string;
  grade: string;
  isBinaryPass: boolean;
};

export type SemesterDraft = {
  academicYear: string;
  semesterNumber: string;
  season: SemesterSeason;
};

export type AccountDraft = {
  displayName: string;
  email: string;
  fullName: string;
  institution: string;
  degreeProgram: string;
  studentId: string;
  expectedGraduationYear: string;
  targetGpa: string;
  requiredCredits: string;
};

export type PasswordDraft = {
  current: string;
  next: string;
  confirm: string;
};

export const EMPTY_COURSE_DRAFT: CourseDraft = {
  code: "",
  name: "",
  credits: "",
  grade: "",
  isBinaryPass: false
};

export const EMPTY_SEMESTER_DRAFT: SemesterDraft = {
  academicYear: "1",
  semesterNumber: "1",
  season: "Winter A"
};

export const EMPTY_PASSWORD_DRAFT: PasswordDraft = { current: "", next: "", confirm: "" };

export const MIN_PASSWORD_LENGTH = 8;

export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function numberToDraft(value: number | null): string {
  return value === null ? "" : String(value);
}

export function getNextSeason(season: SemesterSeason): SemesterSeason {
  if (season === "Winter A") return "Spring B";
  if (season === "Spring B") return "Summer";
  return "Winter A";
}

export function sortSemesters(semesters: Semester[]): Semester[] {
  return [...semesters].sort((a, b) => {
    if (a.academicYear !== b.academicYear) {
      return a.academicYear - b.academicYear;
    }

    if (a.semesterNumber !== b.semesterNumber) {
      return a.semesterNumber - b.semesterNumber;
    }

    return a.season.localeCompare(b.season);
  });
}

export function summarizeCourses(courses: Course[]): { count: number; credits: number } {
  return {
    count: courses.length,
    credits: courses.reduce((sum, course) => sum + course.credits, 0)
  };
}

export function getNextSemesterDraft(profile: Profile | null): SemesterDraft {
  if (!profile || profile.semesters.length === 0) {
    return { ...EMPTY_SEMESTER_DRAFT };
  }

  const lastSemester = sortSemesters(profile.semesters)[profile.semesters.length - 1];
  const nextAcademicYear = lastSemester.season === "Summer" ? lastSemester.academicYear + 1 : lastSemester.academicYear;

  return {
    academicYear: String(nextAcademicYear),
    semesterNumber: String(profile.semesters.length + 1),
    season: lastSemester.season === "Summer" ? "Winter A" : getNextSeason(lastSemester.season)
  };
}

export function touch(state: AppState): AppState {
  return { ...state, lastModified: Date.now() };
}

export function validateCourseDraft(draft: CourseDraft): string | null {
  if (!draft.name.trim()) return t.course.errors.nameRequired;

  const credits = Number(draft.credits);
  if (draft.credits.trim() === "" || !Number.isFinite(credits) || credits <= 0) {
    return t.course.errors.creditsRequired;
  }

  const gradeText = draft.grade.trim();
  if (gradeText === "") {
    return draft.isBinaryPass ? null : t.course.errors.gradeRequired;
  }

  const grade = Number(gradeText);
  if (!Number.isFinite(grade) || grade < 0 || grade > 100) return t.course.errors.gradeRange;

  return null;
}

export function parseCourseDraft(draft: CourseDraft): Omit<Course, "id"> | null {
  if (validateCourseDraft(draft) !== null) return null;

  const code = draft.code.trim();
  const name = draft.name.trim();
  const credits = Number(draft.credits);
  const gradeText = draft.grade.trim();

  // Grade stays null for binary pass courses, which are excluded from the GPA.
  if (gradeText === "") {
    return { code, name, credits, grade: null, isBinaryPass: true };
  }

  return { code, name, credits, grade: Number(gradeText), isBinaryPass: draft.isBinaryPass };
}
