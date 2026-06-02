import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AuthCredential,
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import {
  calculateAnnualGpas,
  calculateOverallGpa,
  calculateSemesterGpa,
  calculateTotalEarnedCredits,
  formatGpa
} from "./calculations";
import { auth, firebaseInitError, firebaseProjectId, googleProvider } from "./firebase";
import {
  buildDefaultState,
  isValidImportedState,
  loadUserAppState,
  normalizeState,
  saveUserAppState
} from "./firebase-state";
import { SEASONS, createId, type AppState, type Course, type Profile, type Semester, type SemesterSeason } from "./types";

type CourseDraft = {
  name: string;
  credits: string;
  grade: string;
  isBinaryPass: boolean;
};

type SemesterDraft = {
  academicYear: string;
  semesterNumber: string;
  season: SemesterSeason;
};

const EMPTY_COURSE_DRAFT: CourseDraft = {
  name: "",
  credits: "",
  grade: "",
  isBinaryPass: false
};

const EMPTY_SEMESTER_DRAFT: SemesterDraft = {
  academicYear: "1",
  semesterNumber: "1",
  season: "Winter A"
};

const REMEMBERED_EMAIL_KEY = "gpa_tracker_remembered_email";

function getNextSeason(season: SemesterSeason): SemesterSeason {
  if (season === "Winter A") return "Spring B";
  if (season === "Spring B") return "Summer";
  return "Winter A";
}

function sortSemesters(semesters: Semester[]): Semester[] {
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

function getNextSemesterDraft(profile: Profile | null): SemesterDraft {
  if (!profile || profile.semesters.length === 0) {
    return { ...EMPTY_SEMESTER_DRAFT };
  }

  const lastSemester = sortSemesters(profile.semesters)[profile.semesters.length - 1];
  const nextAcademicYear = lastSemester.season === "Summer" ? lastSemester.academicYear + 1 : lastSemester.academicYear;
  const nextSemesterNumber = profile.semesters.length + 1;

  return {
    academicYear: String(nextAcademicYear),
    semesterNumber: String(nextSemesterNumber),
    season: lastSemester.season === "Summer" ? "Winter A" : getNextSeason(lastSemester.season)
  };
}

function touch(state: AppState): AppState {
  return {
    ...state,
    lastModified: Date.now()
  };
}

function parseCourseDraft(draft: CourseDraft): Omit<Course, "id"> | null {
  const name = draft.name.trim();
  if (!name) return null;

  const credits = Number(draft.credits);
  if (!Number.isFinite(credits) || credits <= 0) return null;

  if (draft.isBinaryPass) {
    return { name, credits, grade: null, isBinaryPass: true };
  }

  const grade = Number(draft.grade);
  if (!Number.isFinite(grade) || grade < 0 || grade > 100) return null;

  return { name, credits, grade, isBinaryPass: false };
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "register" | "reset">("signin");
  const [state, setState] = useState<AppState>(buildDefaultState());
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(() => Boolean(localStorage.getItem(REMEMBERED_EMAIL_KEY)));
  const [newProfileName, setNewProfileName] = useState("");
  const [semesterDraftByProfile, setSemesterDraftByProfile] = useState<Record<string, SemesterDraft>>({});
  const [courseDraftBySemester, setCourseDraftBySemester] = useState<Record<string, CourseDraft>>({});
  const [collapsedSemesterById, setCollapsedSemesterById] = useState<Record<string, boolean>>({});
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState("");
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null);
  const [editingSemesterDraft, setEditingSemesterDraft] = useState<SemesterDraft>(EMPTY_SEMESTER_DRAFT);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseDraft, setEditingCourseDraft] = useState<CourseDraft>(EMPTY_COURSE_DRAFT);
  const [showBelowOverallTable, setShowBelowOverallTable] = useState(false);
  const [showWorstImpactTable, setShowWorstImpactTable] = useState(false);
  const [showAllBelowOverallCourses, setShowAllBelowOverallCourses] = useState(false);
  const [showAllWorstCourses, setShowAllWorstCourses] = useState(false);
  const [worstSemesterFilterById, setWorstSemesterFilterById] = useState<Record<string, boolean>>({});
  const [selectedWorstCourseByKey, setSelectedWorstCourseByKey] = useState<Record<string, boolean>>({});
  const [simulatedOverallForSelection, setSimulatedOverallForSelection] = useState<number | null | undefined>(undefined);
  const [simulationSelectionWarning, setSimulationSelectionWarning] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<AuthCredential | null>(null);
  const [pendingGoogleEmail, setPendingGoogleEmail] = useState<string | null>(null);

  const previousSerializedRef = useRef<string>("");
  const hasLoadedUserStateRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setAuthError(null);
      setLoadError(null);
      setImportError(null);
      setImportSuccess(null);
      setUser(nextUser);
      setAuthLoading(false);

      if (!nextUser) {
        hasLoadedUserStateRef.current = false;
        previousSerializedRef.current = "";
        setState(buildDefaultState());
        return;
      }

      setDataLoading(true);
      try {
        const loaded = await loadUserAppState(nextUser.uid);
        const normalized = normalizeState(loaded);
        previousSerializedRef.current = JSON.stringify(normalized);
        hasLoadedUserStateRef.current = true;
        setState(normalized);
      } catch (_error) {
        const fallback = buildDefaultState();
        previousSerializedRef.current = JSON.stringify(fallback);
        hasLoadedUserStateRef.current = true;
        setState(fallback);
        setLoadError("Failed to load your Firestore document. A default profile was initialized.");
      } finally {
        setDataLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!rememberEmail) {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      return;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, trimmedEmail);
    }
  }, [email, rememberEmail]);

  useEffect(() => {
    if (!user || !hasLoadedUserStateRef.current) {
      return;
    }

    const serialized = JSON.stringify(state);
    if (serialized === previousSerializedRef.current) {
      return;
    }

    previousSerializedRef.current = serialized;
    setSaveError(null);

    void saveUserAppState(user.uid, state).catch(() => {
      setSaveError("Auto-save to Firestore failed.");
    });
  }, [state, user]);

  const activeProfile = useMemo(() => {
    return state.profiles.find((profile) => profile.id === state.activeProfileId) ?? null;
  }, [state.activeProfileId, state.profiles]);

  const activeSemesterDraft = useMemo(() => {
    return semesterDraftByProfile[activeProfile?.id ?? ""] ?? getNextSemesterDraft(activeProfile);
  }, [activeProfile, semesterDraftByProfile]);

  const annualGpas = useMemo(() => (activeProfile ? calculateAnnualGpas(activeProfile) : {}), [activeProfile]);
  const sortedActiveSemesters = useMemo(() => (activeProfile ? sortSemesters(activeProfile.semesters) : []), [activeProfile]);
  const overallGpa = activeProfile ? calculateOverallGpa(activeProfile) : null;
  const totalCredits = activeProfile ? calculateTotalEarnedCredits(activeProfile) : 0;

  useEffect(() => {
    setWorstSemesterFilterById((prev) => {
      const next: Record<string, boolean> = {};
      for (const semester of sortedActiveSemesters) {
        next[semester.id] = prev[semester.id] ?? true;
      }

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const unchanged =
        prevKeys.length === nextKeys.length &&
        nextKeys.every((id) => prev[id] === next[id]);

      return unchanged ? prev : next;
    });
  }, [sortedActiveSemesters]);

  const coursesBelowOverall = useMemo(() => {
    if (!activeProfile || overallGpa === null) {
      return [] as Array<{
        courseId: string;
        semesterId: string;
        academicYear: number;
        semesterNumber: number;
        season: SemesterSeason;
        courseName: string;
        credits: number;
        grade: number;
        gapFromOverall: number;
        impactScore: number;
      }>;
    }

    return sortSemesters(activeProfile.semesters).flatMap((semester) =>
      semester.courses
        .filter((course) => !course.isBinaryPass && course.grade !== null && course.grade < overallGpa)
        .map((course) => ({
          courseId: course.id,
          semesterId: semester.id,
          academicYear: semester.academicYear,
          semesterNumber: semester.semesterNumber,
          season: semester.season,
          courseName: course.name,
          credits: course.credits,
          grade: course.grade as number,
          gapFromOverall: overallGpa - (course.grade as number),
          impactScore: (overallGpa - (course.grade as number)) * course.credits
        }))
    );
  }, [activeProfile, overallGpa]);

  const worstCoursesFromSelectedSemesters = useMemo(() => {
    return coursesBelowOverall.filter((course) => worstSemesterFilterById[course.semesterId] ?? true);
  }, [coursesBelowOverall, worstSemesterFilterById]);

  const topWorstCourses = useMemo(() => {
    return [...worstCoursesFromSelectedSemesters].sort((a, b) => b.impactScore - a.impactScore);
  }, [worstCoursesFromSelectedSemesters]);

  const visibleBelowOverallCourses = useMemo(() => {
    return showAllBelowOverallCourses ? coursesBelowOverall : coursesBelowOverall.slice(0, 5);
  }, [coursesBelowOverall, showAllBelowOverallCourses]);

  const visibleWorstCourses = useMemo(() => {
    return showAllWorstCourses ? topWorstCourses : topWorstCourses.slice(0, 5);
  }, [showAllWorstCourses, topWorstCourses]);

  useEffect(() => {
    setSelectedWorstCourseByKey((prev) => {
      const allowedKeys = new Set(topWorstCourses.map((course) => `${course.semesterId}_${course.courseId}`));
      const next = Object.fromEntries(
        Object.entries(prev).filter(([key, value]) => value && allowedKeys.has(key))
      ) as Record<string, boolean>;

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const unchanged =
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => prev[key] === next[key]);

      return unchanged ? prev : next;
    });
  }, [topWorstCourses]);

  const setMutatingState = (mutator: (prev: AppState) => AppState) => {
    setState((prev) => touch(mutator(prev)));
  };

  async function handleSignIn() {
    try {
      setAuthError(null);
      setImportSuccess(null);
      googleProvider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const maybeCode =
        typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";

      if (maybeCode === "auth/account-exists-with-different-credential") {
        const pendingCredential = GoogleAuthProvider.credentialFromError(error);
        const emailFromError =
          typeof error === "object" && error !== null && "customData" in error
            ? String(((error as { customData?: { email?: string } }).customData?.email ?? ""))
            : "";
        const normalizedEmail = emailFromError.trim().toLowerCase();

        if (pendingCredential && normalizedEmail) {
          const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail);

          setPendingGoogleCredential(pendingCredential);
          setPendingGoogleEmail(normalizedEmail);
          setEmail(normalizedEmail);
          setPassword("");
          setAuthMode("signin");

          if (methods.includes("password")) {
            setAuthError("This email already has a password account. Sign in with your password once to link Google.");
            return;
          }

          if (methods.length > 0) {
            setAuthError(`This email already exists with: ${methods.join(", ")}. Sign in with that method first, then try Google again.`);
            return;
          }
        }
      }

      const message = error instanceof Error ? error.message : "Unknown Google sign-in error.";
      setAuthError(`Google Sign-In failed: ${message}`);
    }
  }

  async function handleEmailSignIn() {
    try {
      setAuthError(null);
      const normalizedEmail = email.trim().toLowerCase();
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);

      if (pendingGoogleCredential && pendingGoogleEmail && userCredential.user.email?.toLowerCase() === pendingGoogleEmail) {
        try {
          await linkWithCredential(userCredential.user, pendingGoogleCredential);
          setImportSuccess("Google sign-in linked to your existing email account.");
        } catch (linkError) {
          const linkCode =
            typeof linkError === "object" && linkError !== null && "code" in linkError
              ? String((linkError as { code: unknown }).code)
              : "";

          if (linkCode !== "auth/provider-already-linked") {
            const message = linkError instanceof Error ? linkError.message : "Unknown account-linking error.";
            setAuthError(`Signed in, but Google linking failed: ${message}`);
          }
        } finally {
          setPendingGoogleCredential(null);
          setPendingGoogleEmail(null);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown email sign-in error.";
      setAuthError(`Email sign-in failed: ${message}`);
    }
  }

  async function handleRegister() {
    try {
      setAuthError(null);
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown registration error.";
      setAuthError(`Registration failed: ${message}`);
    }
  }

  async function handleResetPassword() {
    try {
      setAuthError(null);
      setImportError(null);
      if (!email.trim()) {
        setAuthError("Enter your email address to receive a password reset link.");
        return;
      }
      await sendPasswordResetEmail(auth, email.trim());
      setImportSuccess("Password reset email sent.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown password reset error.";
      setAuthError(`Password reset failed: ${message}`);
    }
  }

  async function handleSignOutUser() {
    try {
      await signOut(auth);
    } catch (_error) {
      setAuthError("Sign out failed.");
    }
  }

  function handleDownloadBackup() {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "app_data.json";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function handleExportExcel() {
    if (!activeProfile) return;

    const semesterRows = sortSemesters(activeProfile.semesters).flatMap((semester) => {
      const semesterGpa = calculateSemesterGpa(semester.courses);

      return semester.courses.map((course) => ({
        Profile: activeProfile.name,
        AcademicYear: semester.academicYear,
        SemesterNumber: semester.semesterNumber,
        Season: semester.season,
        Course: course.name,
        Credits: course.credits,
        Grade: course.isBinaryPass ? "N/A" : course.grade,
        BinaryPass: course.isBinaryPass ? "Yes" : "No",
        SemesterGPA: formatGpa(semesterGpa),
        OverallGPA: formatGpa(overallGpa)
      }));
    });

    const belowOverallRows = coursesBelowOverall.map((course) => ({
      Profile: activeProfile.name,
      AcademicYear: course.academicYear,
      SemesterNumber: course.semesterNumber,
      Season: course.season,
      Course: course.courseName,
      Credits: course.credits,
      Grade: course.grade,
      GapFromOverall: course.gapFromOverall.toFixed(2),
      ImpactScore: course.impactScore.toFixed(2),
      OverallGPA: formatGpa(overallGpa)
    }));

    const workbook = XLSX.utils.book_new();
    const coursesSheet = XLSX.utils.json_to_sheet(
      semesterRows.length > 0
        ? semesterRows
        : [
            {
              Profile: activeProfile.name,
              AcademicYear: "",
              SemesterNumber: "",
              Season: "",
              Course: "",
              Credits: "",
              Grade: "",
              BinaryPass: "",
              SemesterGPA: "",
              OverallGPA: formatGpa(overallGpa)
            }
          ]
    );
    XLSX.utils.book_append_sheet(workbook, coursesSheet, "Courses");

    const belowSheet = XLSX.utils.json_to_sheet(
      belowOverallRows.length > 0
        ? belowOverallRows
        : [
            {
              Profile: activeProfile.name,
              AcademicYear: "",
              SemesterNumber: "",
              Season: "",
              Course: "No non-binary grades below overall GPA",
              Grade: "",
              OverallGPA: formatGpa(overallGpa)
            }
          ]
    );
    XLSX.utils.book_append_sheet(workbook, belowSheet, "Below Overall GPA");

    const safeName = activeProfile.name.trim().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "profile";
    XLSX.writeFile(workbook, `${safeName}_gpa_export.xlsx`);
  }

  async function handleUploadBackup(event: ChangeEvent<HTMLInputElement>) {
    setImportError(null);
    setImportSuccess(null);

    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      setImportError("Please select a .json backup file.");
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!isValidImportedState(parsed)) {
        setImportError("Invalid backup schema. Import was rejected.");
        event.target.value = "";
        return;
      }

      const normalized = normalizeState(parsed);
      previousSerializedRef.current = JSON.stringify(normalized);
      setState(normalized);

      if (user) {
        await saveUserAppState(user.uid, normalized);
      }

      setImportSuccess("Backup imported successfully.");
    } catch (_error) {
      setImportError("Could not parse the JSON backup file.");
    } finally {
      event.target.value = "";
    }
  }

  function handleRememberEmailChange(nextRemember: boolean) {
    setRememberEmail(nextRemember);
    if (!nextRemember) {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    } else if (email.trim()) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
    }
  }

  function handleCreateProfile() {
    const name = newProfileName.trim();
    if (!name) return;

    const id = createId();
    const profile: Profile = { id, name, semesters: [] };

    setMutatingState((prev) => ({
      ...prev,
      profiles: [...prev.profiles, profile],
      activeProfileId: prev.activeProfileId ?? id
    }));

    setNewProfileName("");
  }

  function handleSwitchProfile(id: string) {
    setMutatingState((prev) => ({ ...prev, activeProfileId: id }));
  }

  function handleDeleteProfile(id: string) {
    setMutatingState((prev) => {
      const profiles = prev.profiles.filter((profile) => profile.id !== id);
      const nextProfiles = profiles.length > 0 ? profiles : buildDefaultState().profiles;
      const nextActiveProfileId =
        prev.activeProfileId === id ? nextProfiles[0]?.id ?? null : prev.activeProfileId ?? nextProfiles[0]?.id ?? null;

      return {
        ...prev,
        profiles: nextProfiles,
        activeProfileId: nextActiveProfileId
      };
    });

    setSemesterDraftByProfile((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }

  function beginEditProfile(profile: Profile) {
    setEditingProfileId(profile.id);
    setEditingProfileName(profile.name);
  }

  function saveEditProfile() {
    const name = editingProfileName.trim();
    if (!editingProfileId || !name) return;

    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === editingProfileId
          ? {
              ...profile,
              name
            }
          : profile
      )
    }));

    setEditingProfileId(null);
    setEditingProfileName("");
  }

  function handleSemesterDraftChange(profileId: string, patch: Partial<SemesterDraft>) {
    const currentProfile = state.profiles.find((profile) => profile.id === profileId) ?? null;

    setSemesterDraftByProfile((prev) => ({
      ...prev,
      [profileId]: (() => {
        const next = {
          ...(prev[profileId] ?? getNextSemesterDraft(currentProfile)),
          ...patch
        };

        if (patch.academicYear !== undefined && patch.semesterNumber === undefined) {
          next.semesterNumber = String((currentProfile?.semesters.length ?? 0) + 1);
          next.season = "Winter A";
        }

        return next;
      })()
    }));
  }

  function handleAddSemester(profileId: string) {
    const currentProfile = state.profiles.find((profile) => profile.id === profileId) ?? null;
    const draft = semesterDraftByProfile[profileId] ?? getNextSemesterDraft(currentProfile);
    const academicYear = Number(draft.academicYear);
    const semesterNumber = Number(draft.semesterNumber);

    if (!Number.isInteger(academicYear) || academicYear <= 0) return;
    if (!Number.isInteger(semesterNumber) || semesterNumber <= 0) return;

    const newSemester: Semester = {
      id: createId(),
      academicYear,
      semesterNumber,
      season: draft.season,
      courses: []
    };

    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              semesters: sortSemesters([...profile.semesters, newSemester])
            }
          : profile
      )
    }));

    const updatedProfile =
      activeProfile?.id === profileId
        ? {
            ...activeProfile,
            semesters: sortSemesters([...activeProfile.semesters, newSemester])
          }
        : null;

    setSemesterDraftByProfile((prev) => ({
      ...prev,
      [profileId]: updatedProfile ? getNextSemesterDraft(updatedProfile) : getNextSemesterDraft(currentProfile)
    }));
  }

  function beginEditSemester(semester: Semester) {
    setEditingSemesterId(semester.id);
    setEditingSemesterDraft({
      academicYear: String(semester.academicYear),
      semesterNumber: String(semester.semesterNumber),
      season: semester.season
    });
  }

  function cancelEditSemester() {
    setEditingSemesterId(null);
    setEditingSemesterDraft({ ...EMPTY_SEMESTER_DRAFT });
  }

  function saveEditSemester(profileId: string, semesterId: string) {
    if (!editingSemesterId) return;

    const academicYear = Number(editingSemesterDraft.academicYear);
    const semesterNumber = Number(editingSemesterDraft.semesterNumber);

    if (!Number.isInteger(academicYear) || academicYear <= 0) return;
    if (!Number.isInteger(semesterNumber) || semesterNumber <= 0) return;

    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              semesters: profile.semesters.map((semester) =>
                semester.id === semesterId
                  ? {
                      ...semester,
                      academicYear,
                      semesterNumber,
                      season: editingSemesterDraft.season
                    }
                  : semester
              )
            }
          : profile
      )
    }));

    const editedProfile =
      activeProfile?.id === profileId
        ? {
            ...activeProfile,
            semesters: activeProfile.semesters.map((semester) =>
              semester.id === semesterId
                ? {
                    ...semester,
                    academicYear,
                    semesterNumber,
                    season: editingSemesterDraft.season
                  }
                : semester
            )
          }
        : null;

    setSemesterDraftByProfile((prev) => ({
      ...prev,
      [profileId]: getNextSemesterDraft(editedProfile)
    }));

    cancelEditSemester();
  }

  function handleDeleteSemester(profileId: string, semesterId: string) {
    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              semesters: profile.semesters.filter((semester) => semester.id !== semesterId)
            }
          : profile
      )
    }));

    setCourseDraftBySemester((prev) => {
      const { [semesterId]: _removed, ...rest } = prev;
      return rest;
    });

    setCollapsedSemesterById((prev) => {
      const { [semesterId]: _removed, ...rest } = prev;
      return rest;
    });

    if (editingSemesterId === semesterId) {
      cancelEditSemester();
    }
  }

  function toggleSemesterCollapsed(semesterId: string) {
    setCollapsedSemesterById((prev) => ({
      ...prev,
      [semesterId]: !prev[semesterId]
    }));
  }

  function toggleWorstSemesterFilter(semesterId: string, checked: boolean) {
    setWorstSemesterFilterById((prev) => ({
      ...prev,
      [semesterId]: checked
    }));
  }

  function setAllWorstSemesters(selected: boolean) {
    setWorstSemesterFilterById((prev) => {
      const next = { ...prev };
      for (const semester of sortedActiveSemesters) {
        next[semester.id] = selected;
      }
      return next;
    });
  }

  function toggleWorstCourseSelection(semesterId: string, courseId: string, selected: boolean) {
    const key = `${semesterId}_${courseId}`;
    setSelectedWorstCourseByKey((prev) => ({
      ...prev,
      [key]: selected
    }));
    setSimulationSelectionWarning(null);
  }

  function simulateSelectedWorstCoursesAsBinary() {
    if (!activeProfile) return;

    const selectedKeys = new Set(
      Object.entries(selectedWorstCourseByKey)
        .filter(([, value]) => value)
        .map(([key]) => key)
    );

    if (selectedKeys.size === 0) {
      setSimulationSelectionWarning("Select at least one course to simulate.");
      setSimulatedOverallForSelection(undefined);
      return;
    }

    const simulatedProfile: Profile = {
      ...activeProfile,
      semesters: activeProfile.semesters.map((semester) =>
        ({
          ...semester,
          courses: semester.courses.map((course) => {
            const key = `${semester.id}_${course.id}`;
            if (!selectedKeys.has(key)) {
              return course;
            }

            return {
              ...course,
              isBinaryPass: true,
              grade: null
            };
          })
        })
      )
    };

    const simulatedOverall = calculateOverallGpa(simulatedProfile);
    setSimulatedOverallForSelection(simulatedOverall);
    setSimulationSelectionWarning(null);
  }

  function collapseAllSemesters() {
    if (!activeProfile) return;

    setCollapsedSemesterById((prev) => ({
      ...prev,
      ...Object.fromEntries(activeProfile.semesters.map((semester) => [semester.id, true]))
    }));
  }

  function showAllSemesters() {
    if (!activeProfile) return;

    setCollapsedSemesterById((prev) => ({
      ...prev,
      ...Object.fromEntries(activeProfile.semesters.map((semester) => [semester.id, false]))
    }));
  }

  function handleCourseDraftChange(semesterId: string, patch: Partial<CourseDraft>) {
    setCourseDraftBySemester((prev) => {
      const current = prev[semesterId] ?? EMPTY_COURSE_DRAFT;
      const next = { ...current, ...patch };
      if (next.isBinaryPass) {
        next.grade = "";
      }
      return {
        ...prev,
        [semesterId]: next
      };
    });
  }

  function handleAddCourse(profileId: string, semesterId: string) {
    const draft = courseDraftBySemester[semesterId] ?? EMPTY_COURSE_DRAFT;
    const parsed = parseCourseDraft(draft);
    if (!parsed) return;

    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              semesters: profile.semesters.map((semester) =>
                semester.id === semesterId
                  ? {
                      ...semester,
                      courses: [...semester.courses, { ...parsed, id: createId() }]
                    }
                  : semester
              )
            }
          : profile
      )
    }));

    setCourseDraftBySemester((prev) => ({
      ...prev,
      [semesterId]: { ...EMPTY_COURSE_DRAFT }
    }));
  }

  function handleDeleteCourse(profileId: string, semesterId: string, courseId: string) {
    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              semesters: profile.semesters.map((semester) =>
                semester.id === semesterId
                  ? {
                      ...semester,
                      courses: semester.courses.filter((course) => course.id !== courseId)
                    }
                  : semester
              )
            }
          : profile
      )
    }));
  }

  function beginEditCourse(course: Course) {
    setEditingCourseId(course.id);
    setEditingCourseDraft({
      name: course.name,
      credits: String(course.credits),
      grade: course.grade === null ? "" : String(course.grade),
      isBinaryPass: course.isBinaryPass
    });
  }

  function cancelEditCourse() {
    setEditingCourseId(null);
    setEditingCourseDraft({ ...EMPTY_COURSE_DRAFT });
  }

  function saveEditCourse(profileId: string, semesterId: string) {
    if (!editingCourseId) return;

    const parsed = parseCourseDraft(editingCourseDraft);
    if (!parsed) return;

    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              semesters: profile.semesters.map((semester) =>
                semester.id === semesterId
                  ? {
                      ...semester,
                      courses: semester.courses.map((course) =>
                        course.id === editingCourseId ? { ...course, ...parsed } : course
                      )
                    }
                  : semester
              )
            }
          : profile
      )
    }));

    cancelEditCourse();
  }

  if (authLoading) {
    return <div className="status-screen">Checking authentication...</div>;
  }

  if (!user) {
    return (
      <div className="landing-shell">
        <section className="landing-card">
          <h1>Degree GPA Calculator</h1>
          <p>Sign in with Google or email to access your cloud-synced degree profiles, semesters, and GPA records.</p>
          <div className="banner info">Firebase project: {firebaseProjectId}</div>
          {firebaseInitError && <div className="banner error">Firebase init error: {firebaseInitError}</div>}
          <div className="auth-tabs">
            <button type="button" className={authMode === "signin" ? "neutral" : ""} onClick={() => setAuthMode("signin")}>
              Sign In
            </button>
            <button type="button" className={authMode === "register" ? "neutral" : ""} onClick={() => setAuthMode("register")}>
              Register
            </button>
            <button type="button" className={authMode === "reset" ? "neutral" : ""} onClick={() => setAuthMode("reset")}>
              Reset Password
            </button>
          </div>
          <div className="auth-form">
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            {authMode !== "reset" && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete={authMode === "register" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                />
              </label>
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(event) => handleRememberEmailChange(event.target.checked)}
              />
              Remember email on this device
            </label>
          </div>
          <div className="actions-inline">
            {authMode === "signin" && (
              <>
                <button type="button" onClick={handleEmailSignIn}>
                  Sign In With Email
                </button>
                <button type="button" className="neutral" onClick={handleSignIn}>
                  Continue with Google
                </button>
              </>
            )}
            {authMode === "register" && (
              <>
                <button type="button" onClick={handleRegister}>
                  Create Account
                </button>
                <button type="button" className="neutral" onClick={handleSignIn}>
                  Use Google Instead
                </button>
              </>
            )}
            {authMode === "reset" && (
              <button type="button" onClick={handleResetPassword}>
                Send Reset Link
              </button>
            )}
          </div>
          {authError && <div className="banner error">{authError}</div>}
        </section>
      </div>
    );
  }

  if (dataLoading) {
    return <div className="status-screen">Loading your Firestore data...</div>;
  }

  return (
    <div className="app-shell">
      <header className="topbar topbar-authenticated">
        <div>
          <h1>Degree GPA Calculator</h1>
          <div className="user-meta">Signed in as {user.displayName ?? user.email ?? user.uid}</div>
        </div>
        <div className="backup-tools">
          <button type="button" className="neutral" onClick={handleDownloadBackup}>
            Download Backup (JSON)
          </button>
          <button type="button" className="neutral" onClick={handleExportExcel}>
            Export To Excel
          </button>
          <label className="upload-label">
            Upload Backup (JSON)
            <input type="file" accept=".json,application/json" onChange={handleUploadBackup} />
          </label>
          <button type="button" className="neutral" onClick={handleSignOutUser}>
            Sign Out
          </button>
        </div>
        <div className="timestamp">Last modified: {new Date(state.lastModified).toLocaleString()}</div>
      </header>

      {loadError && <div className="banner warning">{loadError}</div>}
      {saveError && <div className="banner error">{saveError}</div>}
      {importError && <div className="banner error">{importError}</div>}
      {importSuccess && <div className="banner success">{importSuccess}</div>}
      <div className="banner info">Firebase project: {firebaseProjectId}</div>
      {firebaseInitError && <div className="banner error">Firebase init error: {firebaseInitError}</div>}

      <main className="layout">
        <aside className="panel profiles-panel">
          <h2>Profiles</h2>
          <div className="create-inline">
            <input
              type="text"
              value={newProfileName}
              onChange={(event) => setNewProfileName(event.target.value)}
              placeholder="New profile name"
            />
            <button type="button" onClick={handleCreateProfile}>
              Add
            </button>
          </div>

          <ul className="profiles-list">
            {state.profiles.map((profile) => {
              const isActive = state.activeProfileId === profile.id;
              const isEditing = editingProfileId === profile.id;
              return (
                <li key={profile.id} className={isActive ? "active" : ""}>
                  {isEditing ? (
                    <div className="edit-inline">
                      <input type="text" value={editingProfileName} onChange={(event) => setEditingProfileName(event.target.value)} />
                      <button type="button" onClick={saveEditProfile}>
                        Save
                      </button>
                      <button type="button" className="neutral" onClick={() => setEditingProfileId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button type="button" className="profile-name" onClick={() => handleSwitchProfile(profile.id)}>
                        {profile.name}
                      </button>
                      <div className="actions-inline">
                        <button type="button" className="neutral" onClick={() => beginEditProfile(profile)}>
                          Edit
                        </button>
                        <button type="button" className="danger" onClick={() => handleDeleteProfile(profile.id)}>
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="panel main-panel">
          {!activeProfile ? (
            <div className="empty">Create and select a profile to start.</div>
          ) : (
            <>
              <div className="stats-grid">
                <article className="stat-card">
                  <h3>Overall GPA</h3>
                  <div className="metric">{formatGpa(overallGpa)}</div>
                </article>
                <article className="stat-card">
                  <h3>Total Earned Credits</h3>
                  <div className="metric">{totalCredits.toFixed(1)}</div>
                </article>
              </div>

              <section className="annual-block">
                <h3>Annual GPA</h3>
                <div className="annual-list">
                  {Object.keys(annualGpas)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map((year) => (
                      <div key={year} className="annual-item">
                        <span>Academic Year {year}</span>
                        <strong>{formatGpa(annualGpas[year] ?? null)}</strong>
                      </div>
                    ))}
                  {Object.keys(annualGpas).length === 0 && <div className="muted">No annual GPA available yet.</div>}
                </div>
              </section>

              <section className="below-overall-block">
                <h3>Non-Binary Courses Below Overall GPA</h3>
                <div className="actions-inline">
                  <button type="button" className="neutral" onClick={() => setShowBelowOverallTable((prev) => !prev)}>
                    {showBelowOverallTable ? "Hide Non-Binary Courses Below Overall GPA" : "Show Non-Binary Courses Below Overall GPA"}
                  </button>
                  <button type="button" className="neutral" onClick={() => setShowWorstImpactTable((prev) => !prev)}>
                    {showWorstImpactTable ? "Hide Worst Courses For GPA Impact" : "Show Worst Courses For GPA Impact"}
                  </button>
                </div>
                {overallGpa === null ? (
                  <div className="muted">Overall GPA is not available yet.</div>
                ) : coursesBelowOverall.length === 0 ? (
                  <div className="muted">No non-binary courses are below your current overall GPA ({formatGpa(overallGpa)}).</div>
                ) : (
                  <>
                    {showBelowOverallTable && (
                      <>
                        <div className="insight-table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Year</th>
                                <th>Semester</th>
                                <th>Season</th>
                                <th>Course</th>
                                <th>Grade</th>
                                <th>Credits</th>
                                <th>Impact</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleBelowOverallCourses.map((course) => (
                                <tr
                                  key={`${course.semesterId}_${course.courseName}_${course.grade}_${course.credits}`}
                                  className={`year-row-tone-${((course.academicYear - 1) % 6) + 1}`}
                                >
                                  <td>{course.academicYear}</td>
                                  <td>{course.semesterNumber}</td>
                                  <td>{course.season}</td>
                                  <td>{course.courseName}</td>
                                  <td>{course.grade}</td>
                                  <td>{course.credits.toFixed(1)}</td>
                                  <td>{course.impactScore.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {coursesBelowOverall.length > 5 && (
                          <div className="actions-inline">
                            {!showAllBelowOverallCourses ? (
                              <button type="button" className="neutral" onClick={() => setShowAllBelowOverallCourses(true)}>
                                Show All
                              </button>
                            ) : (
                              <button type="button" className="neutral" onClick={() => setShowAllBelowOverallCourses(false)}>
                                Hide All
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    {showWorstImpactTable && (
                      <>
                        <h4>Worst Courses For GPA Impact</h4>
                        <div className="worst-semester-filter">
                          <div className="actions-inline">
                            <button type="button" className="neutral" onClick={() => setAllWorstSemesters(true)}>
                              Select All Semesters
                            </button>
                            <button type="button" className="neutral" onClick={() => setAllWorstSemesters(false)}>
                              Clear All Semesters
                            </button>
                          </div>
                          <div className="worst-semester-filter-grid">
                            {sortedActiveSemesters.map((semester) => (
                              <label key={`worst_filter_${semester.id}`} className="checkbox-label worst-semester-option">
                                <input
                                  type="checkbox"
                                  checked={worstSemesterFilterById[semester.id] ?? true}
                                  onChange={(event) => toggleWorstSemesterFilter(semester.id, event.target.checked)}
                                />
                                Year {semester.academicYear} | Sem {semester.semesterNumber} | {semester.season}
                              </label>
                            ))}
                          </div>
                        </div>

                        {topWorstCourses.length === 0 ? (
                          <div className="muted">No matching courses for the selected semesters.</div>
                        ) : (
                          <>
                            <div className="actions-inline">
                              <button type="button" className="neutral" onClick={simulateSelectedWorstCoursesAsBinary}>
                                Simulate Overall Grade
                              </button>
                              <button type="button" className="neutral" onClick={() => setSelectedWorstCourseByKey({})}>
                                Clear Selected Courses
                              </button>
                            </div>
                            {simulationSelectionWarning && <div className="muted">{simulationSelectionWarning}</div>}
                            {simulatedOverallForSelection !== undefined && (
                              <div className="banner info">
                                Simulated overall GPA (selected courses as binary): {formatGpa(simulatedOverallForSelection)}
                              </div>
                            )}
                            <div className="insight-table-wrap">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Select</th>
                                    <th>Rank</th>
                                    <th>Year</th>
                                    <th>Semester</th>
                                    <th>Season</th>
                                    <th>Course</th>
                                    <th>Grade</th>
                                    <th>Credits</th>
                                    <th>Impact</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {visibleWorstCourses.map((course, index) => (
                                    <tr
                                      key={`worst_${course.semesterId}_${course.courseName}_${course.grade}_${course.credits}`}
                                      className={`year-row-tone-${((course.academicYear - 1) % 6) + 1}`}
                                    >
                                      <td>
                                        <input
                                          type="checkbox"
                                          checked={selectedWorstCourseByKey[`${course.semesterId}_${course.courseId}`] ?? false}
                                          onChange={(event) =>
                                            toggleWorstCourseSelection(course.semesterId, course.courseId, event.target.checked)
                                          }
                                        />
                                      </td>
                                      <td>{index + 1}</td>
                                      <td>{course.academicYear}</td>
                                      <td>{course.semesterNumber}</td>
                                      <td>{course.season}</td>
                                      <td>{course.courseName}</td>
                                      <td>{course.grade}</td>
                                      <td>{course.credits.toFixed(1)}</td>
                                      <td>{course.impactScore.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {topWorstCourses.length > 5 && (
                              <div className="actions-inline">
                                {!showAllWorstCourses ? (
                                  <button type="button" className="neutral" onClick={() => setShowAllWorstCourses(true)}>
                                    Show All
                                  </button>
                                ) : (
                                  <button type="button" className="neutral" onClick={() => setShowAllWorstCourses(false)}>
                                    Hide All
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>

              <section className="semester-create">
                <h3>Add Semester</h3>
                <div className="row-fields">
                  <label>
                    Year
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={activeSemesterDraft.academicYear}
                      onChange={(event) => handleSemesterDraftChange(activeProfile.id, { academicYear: event.target.value })}
                    />
                  </label>
                  <label>
                    Semester #
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={activeSemesterDraft.semesterNumber}
                      onChange={(event) => handleSemesterDraftChange(activeProfile.id, { semesterNumber: event.target.value })}
                    />
                  </label>
                  <label>
                    Season
                    <select
                      value={activeSemesterDraft.season}
                      onChange={(event) => handleSemesterDraftChange(activeProfile.id, { season: event.target.value as SemesterSeason })}
                    >
                      {SEASONS.map((season) => (
                        <option key={season} value={season}>
                          {season}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={() => handleAddSemester(activeProfile.id)}>
                    Add Semester
                  </button>
                </div>
              </section>

              <section className="semesters-list">
                <div className="actions-inline">
                  <button type="button" className="neutral" onClick={collapseAllSemesters}>
                    Collapse All
                  </button>
                  <button type="button" className="neutral" onClick={showAllSemesters}>
                    Show All
                  </button>
                </div>
                {sortedActiveSemesters.map((semester) => {
                  const semesterGpa = calculateSemesterGpa(semester.courses);
                  const courseDraft = courseDraftBySemester[semester.id] ?? EMPTY_COURSE_DRAFT;
                  const isEditingSemester = editingSemesterId === semester.id;
                  const isCollapsed = collapsedSemesterById[semester.id] ?? true;
                  const yearToneClass = `year-tone-${((semester.academicYear - 1) % 6) + 1}`;

                  return (
                    <article key={semester.id} className={`semester-card ${yearToneClass}`}>
                      <header>
                        <h3>
                          Year {semester.academicYear} | Semester {semester.semesterNumber} | {semester.season}
                        </h3>
                        <div className="actions-inline">
                          <span className="gpa-pill">Semester GPA: {formatGpa(semesterGpa)}</span>
                          <button type="button" className="neutral" onClick={() => toggleSemesterCollapsed(semester.id)}>
                            {isCollapsed ? "Expand" : "Collapse"}
                          </button>
                          {isEditingSemester ? (
                            <>
                              <button type="button" onClick={() => saveEditSemester(activeProfile.id, semester.id)}>
                                Save Semester
                              </button>
                              <button type="button" className="neutral" onClick={cancelEditSemester}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button type="button" className="neutral" onClick={() => beginEditSemester(semester)}>
                              Edit Semester
                            </button>
                          )}
                          <button type="button" className="danger" onClick={() => handleDeleteSemester(activeProfile.id, semester.id)}>
                            Remove Semester
                          </button>
                        </div>
                      </header>

                      {!isCollapsed && (
                        <div className="semester-body">
                          {isEditingSemester && (
                            <div className="semester-edit-grid">
                              <label>
                                Year
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={editingSemesterDraft.academicYear}
                                  onChange={(event) =>
                                    setEditingSemesterDraft((prev) => ({
                                      ...prev,
                                      academicYear: event.target.value
                                    }))
                                  }
                                />
                              </label>
                              <label>
                                Semester #
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={editingSemesterDraft.semesterNumber}
                                  onChange={(event) =>
                                    setEditingSemesterDraft((prev) => ({
                                      ...prev,
                                      semesterNumber: event.target.value
                                    }))
                                  }
                                />
                              </label>
                              <label>
                                Season
                                <select
                                  value={editingSemesterDraft.season}
                                  onChange={(event) =>
                                    setEditingSemesterDraft((prev) => ({
                                      ...prev,
                                      season: event.target.value as SemesterSeason
                                    }))
                                  }
                                >
                                  {SEASONS.map((season) => (
                                    <option key={season} value={season}>
                                      {season}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          )}

                          <div className="course-create">
                            <h4>Add Course</h4>
                            <div className="row-fields compact">
                              <label>
                                Name
                                <input type="text" value={courseDraft.name} onChange={(event) => handleCourseDraftChange(semester.id, { name: event.target.value })} />
                              </label>
                              <label>
                                Credits
                                <input type="number" min={0} step={0.5} value={courseDraft.credits} onChange={(event) => handleCourseDraftChange(semester.id, { credits: event.target.value })} />
                              </label>
                              <label>
                                Grade (0-100)
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  disabled={courseDraft.isBinaryPass}
                                  value={courseDraft.grade}
                                  onChange={(event) => handleCourseDraftChange(semester.id, { grade: event.target.value })}
                                />
                              </label>
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={courseDraft.isBinaryPass}
                                  onChange={(event) => handleCourseDraftChange(semester.id, { isBinaryPass: event.target.checked })}
                                />
                                Binary Pass (Pass/Fail)
                              </label>
                              <button type="button" onClick={() => handleAddCourse(activeProfile.id, semester.id)}>
                                Add Course
                              </button>
                            </div>
                          </div>

                          <div className="courses-table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Course</th>
                                  <th>Credits</th>
                                  <th>Grade</th>
                                  <th>Binary Pass</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {semester.courses.map((course) => {
                                  const isEditing = editingCourseId === course.id;
                                  return (
                                    <tr key={course.id}>
                                      {isEditing ? (
                                        <>
                                          <td>
                                            <input type="text" value={editingCourseDraft.name} onChange={(event) => setEditingCourseDraft((prev) => ({ ...prev, name: event.target.value }))} />
                                          </td>
                                          <td>
                                            <input type="number" min={0} step={0.5} value={editingCourseDraft.credits} onChange={(event) => setEditingCourseDraft((prev) => ({ ...prev, credits: event.target.value }))} />
                                          </td>
                                          <td>
                                            <input
                                              type="number"
                                              min={0}
                                              max={100}
                                              disabled={editingCourseDraft.isBinaryPass}
                                              value={editingCourseDraft.grade}
                                              onChange={(event) => setEditingCourseDraft((prev) => ({ ...prev, grade: event.target.value }))}
                                            />
                                          </td>
                                          <td>
                                            <input
                                              type="checkbox"
                                              checked={editingCourseDraft.isBinaryPass}
                                              onChange={(event) => setEditingCourseDraft((prev) => ({ ...prev, isBinaryPass: event.target.checked, grade: event.target.checked ? "" : prev.grade }))}
                                            />
                                          </td>
                                          <td>
                                            <div className="actions-inline">
                                              <button type="button" onClick={() => saveEditCourse(activeProfile.id, semester.id)}>
                                                Save
                                              </button>
                                              <button type="button" className="neutral" onClick={cancelEditCourse}>
                                                Cancel
                                              </button>
                                            </div>
                                          </td>
                                        </>
                                      ) : (
                                        <>
                                          <td>{course.name}</td>
                                          <td>{course.credits.toFixed(1)}</td>
                                          <td>{course.isBinaryPass ? "N/A" : course.grade}</td>
                                          <td>{course.isBinaryPass ? "Yes" : "No"}</td>
                                          <td>
                                            <div className="actions-inline">
                                              <button type="button" className="neutral" onClick={() => beginEditCourse(course)}>
                                                Edit
                                              </button>
                                              <button type="button" className="danger" onClick={() => handleDeleteCourse(activeProfile.id, semester.id, course.id)}>
                                                Delete
                                              </button>
                                            </div>
                                          </td>
                                        </>
                                      )}
                                    </tr>
                                  );
                                })}
                                {semester.courses.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="muted center">
                                      No courses in this semester yet.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
                {sortedActiveSemesters.length === 0 && <div className="empty">No semesters yet. Add the first one above.</div>}
              </section>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
