import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { createId, type AppState, type Course, type Profile, type SemesterSeason, SEASONS } from "./types";

export function buildDefaultState(): AppState {
  const profile: Profile = {
    id: createId(),
    name: "Default Profile",
    semesters: []
  };

  return {
    lastModified: Date.now(),
    theme: "light",
    profiles: [profile],
    activeProfileId: profile.id
  };
}

export function normalizeState(input: unknown): AppState {
  if (!input || typeof input !== "object") {
    return buildDefaultState();
  }

  const source = input as Partial<AppState>;
  const profilesRaw = Array.isArray(source.profiles) ? source.profiles : [];

  const profiles = profilesRaw
    .filter((profile): profile is Profile => Boolean(profile && typeof profile === "object"))
    .map((profile) => {
      const semestersRaw = Array.isArray(profile.semesters) ? profile.semesters : [];
      return {
        id: typeof profile.id === "string" ? profile.id : createId(),
        name: typeof profile.name === "string" ? profile.name : "Unnamed Profile",
        semesters: semestersRaw
          .filter((semester) => Boolean(semester && typeof semester === "object"))
          .map((semester) => {
            const coursesRaw = Array.isArray(semester.courses) ? semester.courses : [];
            return {
              id: typeof semester.id === "string" ? semester.id : createId(),
              academicYear: typeof semester.academicYear === "number" ? semester.academicYear : 1,
              semesterNumber: typeof semester.semesterNumber === "number" ? semester.semesterNumber : 1,
              season: SEASONS.includes(semester.season as SemesterSeason)
                ? (semester.season as SemesterSeason)
                : "Winter A",
              courses: coursesRaw
                .filter((course): course is Course => Boolean(course && typeof course === "object"))
                .map((course) => {
                  const isBinaryPass = Boolean(course.isBinaryPass);
                  return {
                    id: typeof course.id === "string" ? course.id : createId(),
                    name: typeof course.name === "string" ? course.name : "Unnamed Course",
                    credits: typeof course.credits === "number" ? course.credits : 0,
                    grade: isBinaryPass ? null : typeof course.grade === "number" ? course.grade : null,
                    isBinaryPass
                  };
                })
            };
          })
      };
    });

  const activeProfileId =
    typeof source.activeProfileId === "string" && profiles.some((profile) => profile.id === source.activeProfileId)
      ? source.activeProfileId
      : profiles[0]?.id ?? null;

  return {
    lastModified: typeof source.lastModified === "number" ? source.lastModified : Date.now(),
    theme: source.theme === "dark" || source.theme === "light" ? source.theme : "light",
    profiles: profiles.length > 0 ? profiles : buildDefaultState().profiles,
    activeProfileId
  };
}

export function isValidImportedState(input: unknown): input is AppState {
  if (!input || typeof input !== "object") {
    return false;
  }

  const state = input as Partial<AppState>;
  if (typeof state.lastModified !== "number" || !Array.isArray(state.profiles)) {
    return false;
  }

  if (state.theme !== undefined && state.theme !== "dark" && state.theme !== "light") {
    return false;
  }

  if (!(typeof state.activeProfileId === "string" || state.activeProfileId === null)) {
    return false;
  }

  for (const profile of state.profiles) {
    if (!profile || typeof profile !== "object") {
      return false;
    }

    if (typeof profile.id !== "string" || typeof profile.name !== "string" || !Array.isArray(profile.semesters)) {
      return false;
    }

    for (const semester of profile.semesters) {
      if (!semester || typeof semester !== "object") {
        return false;
      }

      if (
        typeof semester.id !== "string" ||
        typeof semester.academicYear !== "number" ||
        typeof semester.semesterNumber !== "number" ||
        !SEASONS.includes(semester.season as SemesterSeason) ||
        !Array.isArray(semester.courses)
      ) {
        return false;
      }

      for (const course of semester.courses) {
        if (!course || typeof course !== "object") {
          return false;
        }

        const validGrade = course.grade === null || typeof course.grade === "number";
        if (
          typeof course.id !== "string" ||
          typeof course.name !== "string" ||
          typeof course.credits !== "number" ||
          !validGrade ||
          typeof course.isBinaryPass !== "boolean"
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

function appStateDoc(uid: string) {
  return doc(db, "appStates", uid);
}

export async function loadUserAppState(uid: string): Promise<AppState> {
  const snap = await getDoc(appStateDoc(uid));
  if (!snap.exists()) {
    const initial = buildDefaultState();
    await setDoc(appStateDoc(uid), initial);
    return initial;
  }

  return normalizeState(snap.data());
}

export async function saveUserAppState(uid: string, state: AppState): Promise<void> {
  await setDoc(appStateDoc(uid), state);
}
