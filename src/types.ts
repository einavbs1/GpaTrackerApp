export type SemesterSeason = "Winter A" | "Spring B" | "Summer";

export interface Course {
  id: string;
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
  semesters: Semester[];
}

export interface AppState {
  lastModified: number;
  profiles: Profile[];
  activeProfileId: string | null;
}

export const SEASONS: SemesterSeason[] = ["Winter A", "Spring B", "Summer"];

export function createEmptyState(): AppState {
  const defaultProfile: Profile = {
    id: createId(),
    name: "Default Profile",
    semesters: []
  };

  return {
    lastModified: Date.now(),
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
