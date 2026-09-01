export type SemesterSeason = "Winter A" | "Spring B" | "Summer";

export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  grade: number | null;
  isBinaryPass: boolean;
}

export interface Semester {
  id: string;
  academicYear: number;
  semesterNumber: number;
  season: SemesterSeason;
  courses: Course[];
}

export interface Profile {
  id: string;
  name: string;
  binaryCreditCap: number | null;
  semesters: Semester[];
}

export interface Account {
  fullName: string;
  institution: string;
  degreeProgram: string;
  studentId: string;
  expectedGraduationYear: number | null;
  targetGpa: number | null;
  requiredCredits: number | null;
}

export interface AppState {
  lastModified: number;
  theme: "dark" | "light";
  account: Account;
  profiles: Profile[];
  activeProfileId: string | null;
}

export function createEmptyAccount(): Account {
  return {
    fullName: "",
    institution: "",
    degreeProgram: "",
    studentId: "",
    expectedGraduationYear: null,
    targetGpa: null,
    requiredCredits: null
  };
}

export const SEASONS: SemesterSeason[] = ["Winter A", "Spring B", "Summer"];

export function createEmptyState(): AppState {
  const defaultProfile: Profile = {
    id: createId(),
    name: "Default Profile",
    binaryCreditCap: null,
    semesters: []
  };

  return {
    lastModified: Date.now(),
    theme: "light",
    account: createEmptyAccount(),
    profiles: [defaultProfile],
    activeProfileId: defaultProfile.id
  };
}

export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}
