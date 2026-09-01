import { ChangeEvent, PointerEvent as ReactPointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AuthCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail
} from "firebase/auth";
import {
  aggregateCourses,
  calculateAnnualGpas,
  calculateOverallGpa,
  calculateSemesterGpa,
  calculateTotalEarnedCredits,
  formatGpa,
  gpaAfterBinarizing
} from "./calculations";
import { auth, firebaseInitError, firebaseProjectId, googleProvider } from "./firebase";
import { Icon } from "./Icon";
import {
  buildDefaultState,
  isValidImportedState,
  loadUserAppState,
  normalizeState,
  saveUserAppState
} from "./firebase-state";
import { SEASONS, createId, type Account, type AppState, type Course, type Profile, type Semester, type SemesterSeason } from "./types";

type AccountDraft = {
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

type PasswordDraft = {
  current: string;
  next: string;
  confirm: string;
};

const EMPTY_PASSWORD_DRAFT: PasswordDraft = { current: "", next: "", confirm: "" };

const MIN_PASSWORD_LENGTH = 8;

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function numberToDraft(value: number | null): string {
  return value === null ? "" : String(value);
}

function describeAuthError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";

  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Current password is incorrect.";
    case "auth/weak-password":
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    case "auth/requires-recent-login":
      return "For security, sign out and sign back in before making this change.";
    case "auth/email-already-in-use":
      return "That email is already used by another account.";
    case "auth/invalid-email":
      return "That email address is not valid.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    default:
      return error instanceof Error ? error.message : "Something went wrong. Try again.";
  }
}


type CourseDraft = {
  code: string;
  name: string;
  credits: string;
  grade: string;
  isBinaryPass: boolean;
};

type BinarySortMode = "impact" | "grade" | "credits" | "chronological";

type BinaryCandidate = {
  key: string;
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
  soloGpa: number | null;
  soloDelta: number | null;
};

const BINARY_SORT_OPTIONS: Array<{ value: BinarySortMode; label: string }> = [
  { value: "impact", label: "Biggest impact" },
  { value: "grade", label: "Lowest grade" },
  { value: "credits", label: "Most credits" },
  { value: "chronological", label: "Chronological" }
];

function formatDelta(value: number | null): string {
  if (value === null) return "";
  if (Math.abs(value) < 0.005) return "\u00b10.00";
  return `${value > 0 ? "+" : "\u2212"}${Math.abs(value).toFixed(2)}`;
}

function deltaClassName(value: number | null): string {
  if (value === null || Math.abs(value) < 0.005) return "sim-delta";
  return value > 0 ? "sim-delta is-positive" : "sim-delta is-negative";
}

type SemesterDraft = {
  academicYear: string;
  semesterNumber: string;
  season: SemesterSeason;
};

const EMPTY_COURSE_DRAFT: CourseDraft = {
  code: "",
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
const THEME_KEY = "gpa_tracker_theme";

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

// Index-based on purpose: a regex built from user input would throw on "(" and risks ReDoS.
function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text;

  const haystack = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let found = haystack.indexOf(query, cursor);

  while (found !== -1) {
    if (found > cursor) {
      parts.push(text.slice(cursor, found));
    }
    parts.push(
      <mark key={`${found}_${parts.length}`} className="search-hit">
        {text.slice(found, found + query.length)}
      </mark>
    );
    cursor = found + query.length;
    found = haystack.indexOf(query, cursor);
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
}

function summarizeCourses(courses: Course[]): { count: number; credits: number } {
  return {
    count: courses.length,
    credits: courses.reduce((sum, course) => sum + course.credits, 0)
  };
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

function validateCourseDraft(draft: CourseDraft): string | null {
  if (!draft.name.trim()) return "Course name is required.";

  const credits = Number(draft.credits);
  if (draft.credits.trim() === "" || !Number.isFinite(credits) || credits <= 0) {
    return "Credits must be a number greater than 0.";
  }

  const gradeText = draft.grade.trim();
  if (gradeText === "") {
    return draft.isBinaryPass ? null : "Grade is required unless the course is binary pass.";
  }

  const grade = Number(gradeText);
  if (!Number.isFinite(grade) || grade < 0 || grade > 100) return "Grade must be between 0 and 100.";

  return null;
}

function parseCourseDraft(draft: CourseDraft): Omit<Course, "id"> | null {
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

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "dark" ? "dark" : "light";
  });
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
  const [collapsedYearByNumber, setCollapsedYearByNumber] = useState<Record<number, boolean>>({});
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
  const [isAddSemesterOpen, setIsAddSemesterOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [accountDraft, setAccountDraft] = useState<AccountDraft | null>(null);
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft>(EMPTY_PASSWORD_DRAFT);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState("");
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null);
  const [editingSemesterDraft, setEditingSemesterDraft] = useState<SemesterDraft>(EMPTY_SEMESTER_DRAFT);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseDraft, setEditingCourseDraft] = useState<CourseDraft>(EMPTY_COURSE_DRAFT);
  const [courseFormError, setCourseFormError] = useState<string | null>(null);
  const [courseFormErrorBySemester, setCourseFormErrorBySemester] = useState<Record<string, string | null>>({});
  const [focusSemesterId, setFocusSemesterId] = useState<string | null>(null);
  const [addCourseSemesterId, setAddCourseSemesterId] = useState<string | null>(null);
  const [addCourseAddedCount, setAddCourseAddedCount] = useState(0);
  const [simulatorMode, setSimulatorMode] = useState<"closed" | "open" | "tab">("closed");
  const [simPos, setSimPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingSim, setIsDraggingSim] = useState(false);
  const [showAllWorstCourses, setShowAllWorstCourses] = useState(false);
  const [binarySortMode, setBinarySortMode] = useState<BinarySortMode>("impact");
  const [worstSemesterFilterById, setWorstSemesterFilterById] = useState<Record<string, boolean>>({});
  const [selectedWorstCourseByKey, setSelectedWorstCourseByKey] = useState<Record<string, boolean>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<AuthCredential | null>(null);
  const [pendingGoogleEmail, setPendingGoogleEmail] = useState<string | null>(null);

  const previousSerializedRef = useRef<string>("");
  const hasLoadedUserStateRef = useRef(false);
  const dataMenuRef = useRef<HTMLDivElement | null>(null);
  const simPanelRef = useRef<HTMLDivElement | null>(null);
  const simDragOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingSimRef = useRef(false);
  const editingCourseOriginalRef = useRef<CourseDraft | null>(null);
  const semesterNodeRefs = useRef<Record<string, HTMLElement | null>>({});
  const courseNameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!isDataMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (dataMenuRef.current && !dataMenuRef.current.contains(event.target as Node)) {
        setIsDataMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsDataMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDataMenuOpen]);

  useEffect(() => {
    if (!isAddSemesterOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsAddSemesterOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isAddSemesterOpen]);

  useEffect(() => {
    if (!isAccountOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsAccountOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isAccountOpen]);

  useEffect(() => {
    if (simulatorMode !== "open") return;

    // Escape minimises rather than closes so an in-progress selection is not lost.
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSimulatorMode("tab");
    }

    function handleResize() {
      setSimPos((prev) => {
        if (!prev) return prev;
        const panel = simPanelRef.current;
        const width = panel?.offsetWidth ?? 560;
        const height = panel?.offsetHeight ?? 400;
        return {
          x: Math.min(Math.max(8, prev.x), Math.max(8, window.innerWidth - width - 8)),
          y: Math.min(Math.max(8, prev.y), Math.max(8, window.innerHeight - height - 8))
        };
      });
    }

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [simulatorMode]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (user) {
      setMutatingState((prev) => (prev.theme === nextTheme ? prev : { ...prev, theme: nextTheme }));
    }
  }

  function runFromMenu(action: () => void) {
    setIsDataMenuOpen(false);
    action();
  }

  function openAddCourse(semesterId: string) {
    setCourseDraftBySemester((prev) => ({ ...prev, [semesterId]: { ...EMPTY_COURSE_DRAFT } }));
    setCourseFormErrorBySemester((prev) => ({ ...prev, [semesterId]: null }));
    setAddCourseAddedCount(0);
    setAddCourseSemesterId(semesterId);
  }

  function closeAddCourse() {
    setAddCourseSemesterId(null);
    setAddCourseAddedCount(0);
  }

  useEffect(() => {
    if (!focusSemesterId) return;

    const frame = requestAnimationFrame(() => {
      semesterNodeRefs.current[focusSemesterId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      openAddCourse(focusSemesterId);
      setFocusSemesterId(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [focusSemesterId]);

  useEffect(() => {
    if (!addCourseSemesterId) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeAddCourse();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [addCourseSemesterId]);

  function clampSimPos(x: number, y: number) {
    const panel = simPanelRef.current;
    const width = panel?.offsetWidth ?? 560;
    const height = panel?.offsetHeight ?? 400;
    return {
      x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - width - 8)),
      y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - height - 8))
    };
  }

  function handleSimDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;

    const panel = simPanelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    simDragOffsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };

    // Pin the current geometry so the CSS right/bottom anchoring stops fighting left/top.
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";

    event.currentTarget.setPointerCapture(event.pointerId);
    isDraggingSimRef.current = true;
    setIsDraggingSim(true);
  }

  // Writes straight to the DOM during the drag; committing to state per pointermove
  // re-renders the whole simulator table and makes it stutter.
  function handleSimDragMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDraggingSimRef.current) return;

    const panel = simPanelRef.current;
    if (!panel) return;

    const offset = simDragOffsetRef.current;
    const next = clampSimPos(event.clientX - offset.x, event.clientY - offset.y);
    panel.style.left = `${next.x}px`;
    panel.style.top = `${next.y}px`;
  }

  function handleSimDragEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDraggingSimRef.current) return;

    isDraggingSimRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);

    const panel = simPanelRef.current;
    if (panel) {
      setSimPos({ x: parseFloat(panel.style.left) || 0, y: parseFloat(panel.style.top) || 0 });
    }
    setIsDraggingSim(false);
  }

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
        setTheme(normalized.theme);
      } catch (_error) {
        const fallback = buildDefaultState();
        previousSerializedRef.current = JSON.stringify(fallback);
        hasLoadedUserStateRef.current = true;
        setState(fallback);
        setTheme(fallback.theme);
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

  const normalizedSearchQuery = courseSearchQuery.trim().toLowerCase();
  const isSearching = normalizedSearchQuery.length > 0;

  const searchMatchesBySemester = useMemo(() => {
    const matches = new Map<string, Set<string>>();
    if (!isSearching) return matches;

    for (const semester of sortedActiveSemesters) {
      const hits = semester.courses
        .filter(
          (course) =>
            course.name.toLowerCase().includes(normalizedSearchQuery) ||
            course.code.toLowerCase().includes(normalizedSearchQuery)
        )
        .map((course) => course.id);
      if (hits.length > 0) {
        matches.set(semester.id, new Set(hits));
      }
    }

    return matches;
  }, [isSearching, normalizedSearchQuery, sortedActiveSemesters]);

  const searchMatchCount = useMemo(() => {
    let total = 0;
    for (const hits of searchMatchesBySemester.values()) {
      total += hits.size;
    }
    return total;
  }, [searchMatchesBySemester]);

  const semesterGroupsByYear = useMemo(() => {
    const byYear = new Map<number, Semester[]>();
    for (const semester of sortedActiveSemesters) {
      const existing = byYear.get(semester.academicYear) ?? [];
      existing.push(semester);
      byYear.set(semester.academicYear, existing);
    }

    return [...byYear.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, semesters]) => {
        const courses = semesters.flatMap((semester) => semester.courses);
        const matchCount = semesters.reduce(
          (sum, semester) => sum + (searchMatchesBySemester.get(semester.id)?.size ?? 0),
          0
        );

        return {
          year,
          semesters,
          gpa: annualGpas[year] ?? null,
          courseCount: courses.length,
          credits: courses.reduce((sum, course) => sum + course.credits, 0),
          matchCount
        };
      });
  }, [annualGpas, searchMatchesBySemester, sortedActiveSemesters]);

  const visibleYearGroups = useMemo(() => {
    if (!isSearching) return semesterGroupsByYear;
    return semesterGroupsByYear
      .filter((group) => group.matchCount > 0)
      .map((group) => ({
        ...group,
        semesters: group.semesters.filter((semester) => searchMatchesBySemester.has(semester.id))
      }));
  }, [isSearching, searchMatchesBySemester, semesterGroupsByYear]);

  function isSemesterExpanded(semesterId: string): boolean {
    if (isSearching) return searchMatchesBySemester.has(semesterId);
    return !(collapsedSemesterById[semesterId] ?? true);
  }

  function isYearExpanded(year: number, matchCount: number): boolean {
    if (isSearching) return matchCount > 0;
    return !(collapsedYearByNumber[year] ?? false);
  }

  const canExpandAll = sortedActiveSemesters.some((semester) => (collapsedSemesterById[semester.id] ?? true));
  const canCollapseAll = sortedActiveSemesters.some((semester) => !(collapsedSemesterById[semester.id] ?? true));

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

  const baseAggregation = useMemo(() => {
    return aggregateCourses(activeProfile ? activeProfile.semesters.flatMap((semester) => semester.courses) : []);
  }, [activeProfile]);

  const existingBinaryCredits = useMemo(() => {
    if (!activeProfile) return 0;
    return activeProfile.semesters
      .flatMap((semester) => semester.courses)
      .filter((course) => course.isBinaryPass)
      .reduce((sum, course) => sum + course.credits, 0);
  }, [activeProfile]);

  const coursesBelowOverall = useMemo(() => {
    if (!activeProfile || overallGpa === null) {
      return [] as BinaryCandidate[];
    }

    return sortSemesters(activeProfile.semesters).flatMap((semester) =>
      semester.courses
        .filter((course) => !course.isBinaryPass && course.grade !== null && course.grade < overallGpa)
        .map((course) => {
          const grade = course.grade as number;
          const soloGpa = gpaAfterBinarizing(baseAggregation, [{ grade, credits: course.credits }]);
          return {
            key: `${semester.id}_${course.id}`,
            courseId: course.id,
            semesterId: semester.id,
            academicYear: semester.academicYear,
            semesterNumber: semester.semesterNumber,
            season: semester.season,
            courseName: course.name,
            credits: course.credits,
            grade,
            gapFromOverall: overallGpa - grade,
            impactScore: (overallGpa - grade) * course.credits,
            soloGpa,
            soloDelta: soloGpa === null ? null : soloGpa - overallGpa
          };
        })
    );
  }, [activeProfile, baseAggregation, overallGpa]);

  const worstCoursesFromSelectedSemesters = useMemo(() => {
    return coursesBelowOverall.filter((course) => worstSemesterFilterById[course.semesterId] ?? true);
  }, [coursesBelowOverall, worstSemesterFilterById]);

  const topWorstCourses = useMemo(() => {
    const sorted = [...worstCoursesFromSelectedSemesters];
    switch (binarySortMode) {
      case "grade":
        return sorted.sort((a, b) => a.grade - b.grade);
      case "credits":
        return sorted.sort((a, b) => b.credits - a.credits);
      case "chronological":
        return sorted;
      case "impact":
      default:
        return sorted.sort((a, b) => b.impactScore - a.impactScore);
    }
  }, [binarySortMode, worstCoursesFromSelectedSemesters]);

  const visibleWorstCourses = useMemo(() => {
    return showAllWorstCourses ? topWorstCourses : topWorstCourses.slice(0, 5);
  }, [showAllWorstCourses, topWorstCourses]);

  const selectedWorstCourses = useMemo(() => {
    return topWorstCourses.filter((course) => selectedWorstCourseByKey[course.key]);
  }, [selectedWorstCourseByKey, topWorstCourses]);

  const simulatedOverallGpa = useMemo(() => {
    if (selectedWorstCourses.length === 0) {
      return overallGpa;
    }

    return gpaAfterBinarizing(
      baseAggregation,
      selectedWorstCourses.map((course) => ({ grade: course.grade, credits: course.credits }))
    );
  }, [baseAggregation, overallGpa, selectedWorstCourses]);

  const simulatedDelta = useMemo(() => {
    if (simulatedOverallGpa === null || overallGpa === null) return null;
    return simulatedOverallGpa - overallGpa;
  }, [overallGpa, simulatedOverallGpa]);

  const selectedBinaryCredits = useMemo(() => {
    return selectedWorstCourses.reduce((sum, course) => sum + course.credits, 0);
  }, [selectedWorstCourses]);

  const binaryCreditCap = activeProfile?.binaryCreditCap ?? null;
  const projectedBinaryCredits = existingBinaryCredits + selectedBinaryCredits;
  const isOverBinaryCap = binaryCreditCap !== null && projectedBinaryCredits > binaryCreditCap;
  const selectedSemesterFilterCount = sortedActiveSemesters.filter(
    (semester) => worstSemesterFilterById[semester.id] ?? true
  ).length;

  useEffect(() => {
    setSelectedWorstCourseByKey((prev) => {
      const allowedKeys = new Set(topWorstCourses.map((course) => course.key));
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

      const code2 = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
      const googleMessages: Record<string, string> = {
        "auth/popup-closed-by-user": "Sign-in window was closed. Please try again.",
        "auth/cancelled-popup-request": "Sign-in was cancelled. Please try again.",
        "auth/popup-blocked": "Pop-up was blocked by your browser. Please allow pop-ups and try again.",
        "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
      };
      setAuthError(googleMessages[code2] ?? (error instanceof Error ? error.message : "Google sign-in failed. Please try again."));
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
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
      const friendlyMessages: Record<string, string> = {
        "auth/invalid-credential": "Incorrect email or password. Please try again.",
        "auth/user-not-found": "No account found with this email address.",
        "auth/wrong-password": "Incorrect password. Please try again.",
        "auth/too-many-requests": "Too many failed attempts. Please wait a moment and try again.",
        "auth/user-disabled": "This account has been disabled. Please contact support.",
        "auth/invalid-email": "Please enter a valid email address.",
      };
      setAuthError(friendlyMessages[code] ?? (error instanceof Error ? error.message : "Sign-in failed. Please try again."));
    }
  }

  async function handleRegister() {
    try {
      setAuthError(null);
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
      const registerMessages: Record<string, string> = {
        "auth/email-already-in-use": "An account with this email already exists. Try signing in instead.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
      };
      setAuthError(registerMessages[code] ?? (error instanceof Error ? error.message : "Registration failed. Please try again."));
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
      setImportSuccess("Password reset email sent. Check your inbox.");
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
      const resetMessages: Record<string, string> = {
        "auth/user-not-found": "No account found with this email address.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
      };
      setAuthError(resetMessages[code] ?? (error instanceof Error ? error.message : "Password reset failed. Please try again."));
    }
  }

  async function handleSignOutUser() {
    try {
      await signOut(auth);
    } catch (_error) {
      setAuthError("Sign out failed.");
    }
  }

  function openAccount() {
    if (!user) return;

    const account = state.account;
    setAccountDraft({
      displayName: user.displayName ?? "",
      email: user.email ?? "",
      fullName: account.fullName,
      institution: account.institution,
      degreeProgram: account.degreeProgram,
      studentId: account.studentId,
      expectedGraduationYear: numberToDraft(account.expectedGraduationYear),
      targetGpa: numberToDraft(account.targetGpa),
      requiredCredits: numberToDraft(account.requiredCredits)
    });
    setPasswordDraft(EMPTY_PASSWORD_DRAFT);
    setAccountError(null);
    setAccountSuccess(null);
    setIsAccountOpen(true);
  }

  function closeAccount() {
    setIsAccountOpen(false);
    setAccountDraft(null);
    setPasswordDraft(EMPTY_PASSWORD_DRAFT);
    setAccountError(null);
    setAccountSuccess(null);
  }

  function patchAccountDraft(patch: Partial<AccountDraft>) {
    setAccountDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function handleSaveAccount() {
    if (!user || !accountDraft) return;

    setAccountBusy(true);
    setAccountError(null);
    setAccountSuccess(null);

    const nextAccount: Account = {
      fullName: accountDraft.fullName.trim(),
      institution: accountDraft.institution.trim(),
      degreeProgram: accountDraft.degreeProgram.trim(),
      studentId: accountDraft.studentId.trim(),
      expectedGraduationYear: parseOptionalNumber(accountDraft.expectedGraduationYear),
      targetGpa: parseOptionalNumber(accountDraft.targetGpa),
      requiredCredits: parseOptionalNumber(accountDraft.requiredCredits)
    };

    const nextDisplayName = accountDraft.displayName.trim();

    try {
      if (nextDisplayName !== (user.displayName ?? "")) {
        await updateProfile(user, { displayName: nextDisplayName || null });
        // Firebase mutates the same User object, so React needs a fresh reference to re-render.
        setUser(Object.assign(Object.create(Object.getPrototypeOf(user)), user));
      }

      setMutatingState((prev) => ({ ...prev, account: nextAccount }));
      setAccountSuccess("Profile details saved.");
    } catch (error) {
      setAccountError(describeAuthError(error));
    } finally {
      setAccountBusy(false);
    }
  }

  async function handleChangePassword() {
    if (!user || !accountDraft) return;

    const currentEmail = user.email;
    if (!currentEmail) {
      setAccountError("This account has no email address, so the password cannot be changed here.");
      return;
    }

    if (passwordDraft.next.length < MIN_PASSWORD_LENGTH) {
      setAccountError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (passwordDraft.next !== passwordDraft.confirm) {
      setAccountError("New password and confirmation do not match.");
      return;
    }

    if (passwordDraft.next === passwordDraft.current) {
      setAccountError("New password must be different from the current one.");
      return;
    }

    setAccountBusy(true);
    setAccountError(null);
    setAccountSuccess(null);

    try {
      const credential = EmailAuthProvider.credential(currentEmail, passwordDraft.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordDraft.next);
      setPasswordDraft(EMPTY_PASSWORD_DRAFT);
      setAccountSuccess("Password updated.");
    } catch (error) {
      setAccountError(describeAuthError(error));
    } finally {
      setAccountBusy(false);
    }
  }

  async function handleChangeEmail() {
    if (!user || !accountDraft) return;

    const currentEmail = user.email;
    const nextEmail = accountDraft.email.trim();

    if (!currentEmail) {
      setAccountError("This account has no email address to change.");
      return;
    }

    if (!nextEmail || nextEmail === currentEmail) {
      setAccountError("Enter a different email address first.");
      return;
    }

    if (!passwordDraft.current) {
      setAccountError("Enter your current password to confirm the email change.");
      return;
    }

    setAccountBusy(true);
    setAccountError(null);
    setAccountSuccess(null);

    try {
      const credential = EmailAuthProvider.credential(currentEmail, passwordDraft.current);
      await reauthenticateWithCredential(user, credential);
      await verifyBeforeUpdateEmail(user, nextEmail);
      setAccountSuccess(`Verification link sent to ${nextEmail}. The address changes once you confirm it.`);
    } catch (error) {
      setAccountError(describeAuthError(error));
    } finally {
      setAccountBusy(false);
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
        CourseCode: course.code,
        Course: course.name,
        Credits: course.credits,
        Grade: course.grade === null ? "N/A" : course.grade,
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
              CourseCode: "",
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
      setTheme(normalized.theme);

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
    const profile: Profile = { id, name, binaryCreditCap: null, semesters: [] };

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
    const profile = state.profiles.find((item) => item.id === id);
    const semesterCount = profile?.semesters.length ?? 0;
    const courseCount = profile?.semesters.reduce((sum, semester) => sum + semester.courses.length, 0) ?? 0;
    const confirmed = window.confirm(
      `Delete profile "${profile?.name ?? id}"?\n\n${semesterCount} semester(s) and ${courseCount} course(s) will be permanently removed. This cannot be undone.`
    );
    if (!confirmed) return;

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

    // Drop the user straight into the new semester so courses can be added right away.
    setCollapsedSemesterById((prev) => ({ ...prev, [newSemester.id]: false }));
    setCollapsedYearByNumber((prev) => ({ ...prev, [academicYear]: false }));
    setCourseSearchQuery("");
    setFocusSemesterId(newSemester.id);
    return newSemester.id;
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
    const semester = state.profiles
      .find((profile) => profile.id === profileId)
      ?.semesters.find((item) => item.id === semesterId);
    const confirmed = window.confirm(
      `Remove Year ${semester?.academicYear} | Semester ${semester?.semesterNumber} | ${semester?.season}?\n\n${
        semester?.courses.length ?? 0
      } course(s) will be permanently removed. This cannot be undone.`
    );
    if (!confirmed) return;

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
    setCollapsedSemesterById((prev) => {
      const isCurrentlyCollapsed = prev[semesterId] ?? true;
      return {
        ...prev,
        [semesterId]: !isCurrentlyCollapsed
      };
    });
  }

  function toggleYearCollapsed(year: number) {
    setCollapsedYearByNumber((prev) => ({
      ...prev,
      [year]: !(prev[year] ?? false)
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
  }

  function handleBinaryCreditCapChange(rawValue: string) {
    if (!activeProfile) return;

    const trimmed = rawValue.trim();
    const parsed = Number(trimmed);
    const nextCap = trimmed === "" || !Number.isFinite(parsed) || parsed <= 0 ? null : parsed;

    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === activeProfile.id ? { ...profile, binaryCreditCap: nextCap } : profile
      )
    }));
  }

  function applySelectedAsBinary() {
    if (!activeProfile || selectedWorstCourses.length === 0) return;

    const selectedKeys = new Set(selectedWorstCourses.map((course) => course.key));
    const confirmed = window.confirm(
      `Mark ${selectedKeys.size} course(s) as binary pass? Their grades stay saved but stop counting toward your GPA.`
    );
    if (!confirmed) return;

    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id !== activeProfile.id
          ? profile
          : {
              ...profile,
              semesters: profile.semesters.map((semester) => ({
                ...semester,
                courses: semester.courses.map((course) =>
                  selectedKeys.has(`${semester.id}_${course.id}`) ? { ...course, isBinaryPass: true } : course
                )
              }))
            }
      )
    }));

    setSelectedWorstCourseByKey({});
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
    setCollapsedYearByNumber({});
  }

  function handleCourseDraftChange(semesterId: string, patch: Partial<CourseDraft>) {
    setCourseDraftBySemester((prev) => {
      const current = prev[semesterId] ?? EMPTY_COURSE_DRAFT;
      const next = { ...current, ...patch };
      return {
        ...prev,
        [semesterId]: next
      };
    });
  }

  function handleAddCourse(profileId: string, semesterId: string) {
    const draft = courseDraftBySemester[semesterId] ?? EMPTY_COURSE_DRAFT;

    const validationError = validateCourseDraft(draft);
    if (validationError) {
      setCourseFormErrorBySemester((prev) => ({ ...prev, [semesterId]: validationError }));
      return;
    }

    const parsed = parseCourseDraft(draft);
    if (!parsed) return;

    setCourseFormErrorBySemester((prev) => ({ ...prev, [semesterId]: null }));

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

    // Dialog stays open so several courses can be entered in one pass.
    setAddCourseAddedCount((prev) => prev + 1);
    courseNameInputRefs.current[semesterId]?.focus();
  }

  function handleDeleteCourse(profileId: string, semesterId: string, courseId: string) {
    const course = state.profiles
      .find((profile) => profile.id === profileId)
      ?.semesters.find((semester) => semester.id === semesterId)
      ?.courses.find((item) => item.id === courseId);
    const confirmed = window.confirm(`Delete course "${course?.name ?? courseId}"? This cannot be undone.`);
    if (!confirmed) return;

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
    const draft: CourseDraft = {
      code: course.code,
      name: course.name,
      credits: String(course.credits),
      grade: course.grade === null ? "" : String(course.grade),
      isBinaryPass: course.isBinaryPass
    };
    editingCourseOriginalRef.current = draft;
    setEditingCourseId(course.id);
    setEditingCourseDraft(draft);
    setCourseFormError(null);
  }

  function cancelEditCourse() {
    const original = editingCourseOriginalRef.current;
    const isDirty =
      original !== null && JSON.stringify(original) !== JSON.stringify(editingCourseDraft);

    // Only interrupt when there is actually something to lose.
    if (isDirty && !window.confirm("Discard your unsaved changes to this course?")) return;

    editingCourseOriginalRef.current = null;
    setEditingCourseId(null);
    setEditingCourseDraft({ ...EMPTY_COURSE_DRAFT });
    setCourseFormError(null);
  }

  function saveEditCourse(profileId: string, semesterId: string) {
    if (!editingCourseId) return;

    const validationError = validateCourseDraft(editingCourseDraft);
    if (validationError) {
      setCourseFormError(validationError);
      return;
    }

    const parsed = parseCourseDraft(editingCourseDraft);
    if (!parsed) return;

    if (!window.confirm(`Save changes to "${parsed.name}"?`)) return;

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
    return (
      <div className="status-screen">
        Checking authentication...
        <VersionFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="landing-shell">
        <section className="landing-card">
          <div className="landing-card-tools">
            <button
              type="button"
              className="icon-btn"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1zm0 17a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0v-2a1 1 0 0 1 1-1zM3 11h2a1 1 0 0 1 0 2H3a1 1 0 0 1 0-2zm16 0h2a1 1 0 0 1 0 2h-2a1 1 0 0 1 0-2zM5.64 4.22 7.05 5.64a1 1 0 0 1-1.41 1.41L4.22 5.64a1 1 0 0 1 1.42-1.42zm11.31 12.73 1.41 1.41a1 1 0 0 1-1.41 1.42l-1.42-1.42a1 1 0 0 1 1.42-1.41zM18.36 4.22a1 1 0 0 1 1.42 1.42l-1.42 1.41a1 1 0 0 1-1.41-1.41zM7.05 18.36a1 1 0 0 1-1.41 1.42l-1.42-1.42a1 1 0 0 1 1.42-1.41z"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.64 13a9 9 0 1 1-10.63-10.6 1 1 0 0 1 1.15 1.34 7 7 0 0 0 8.14 8.11 1 1 0 0 1 1.34 1.15z"
                  />
                </svg>
              )}
            </button>
          </div>
          <div className="landing-hero">
            <div className="landing-icon">🎓</div>
            <h1>Degree GPA Calculator</h1>
            <p>Track your academic progress across semesters, profiles and years — synced to the cloud.</p>
          </div>

          {firebaseInitError && <div className="banner error">Firebase init error: {firebaseInitError}</div>}

          {authMode === "signin" && (
            <>
              <button type="button" className="google-btn" onClick={handleSignIn}>
                <svg className="google-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.15 0 5.64 1.08 7.54 2.84l5.62-5.62C33.72 3.58 29.22 1.5 24 1.5 14.82 1.5 7.06 7.1 3.72 14.96l6.55 5.09C12.02 14.02 17.56 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.5 24.5c0-1.64-.15-3.22-.42-4.75H24v9.01h12.64c-.55 2.93-2.2 5.41-4.68 7.08l7.18 5.58C43.44 37.3 46.5 31.38 46.5 24.5z"/>
                  <path fill="#FBBC05" d="M10.27 28.05A14.53 14.53 0 0 1 9.5 24c0-1.41.24-2.77.65-4.05L3.6 14.86A22.93 22.93 0 0 0 1.5 24c0 3.27.68 6.38 1.9 9.2l6.87-5.15z"/>
                  <path fill="#34A853" d="M24 46.5c5.22 0 9.6-1.72 12.8-4.68l-7.18-5.58c-1.73 1.16-3.95 1.84-5.62 1.84-6.44 0-11.98-4.52-13.73-10.55l-6.55 5.09C7.06 40.9 14.82 46.5 24 46.5z"/>
                  <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
                Continue with Google
              </button>

              <div className="auth-divider"><span>or sign in with email</span></div>

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
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Your password"
                  />
                </label>
                <div className="auth-row-split">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(event) => handleRememberEmailChange(event.target.checked)}
                    />
                    Remember email
                  </label>
                  <button type="button" className="link-btn" onClick={() => setAuthMode("reset")}>
                    Forgot password?
                  </button>
                </div>
              </div>

              <button type="button" className="primary-btn" onClick={handleEmailSignIn}>
                <Icon name="login" /> Sign In
              </button>

              <p className="auth-switch">
                Don't have an account?{" "}
                <button type="button" className="link-btn" onClick={() => setAuthMode("register")}>
                  Create one
                </button>
              </p>
            </>
          )}

          {authMode === "register" && (
            <>
              <button type="button" className="back-btn" onClick={() => setAuthMode("signin")}>
                ← Back to Sign In
              </button>

              <button type="button" className="google-btn" onClick={handleSignIn}>
                <svg className="google-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.15 0 5.64 1.08 7.54 2.84l5.62-5.62C33.72 3.58 29.22 1.5 24 1.5 14.82 1.5 7.06 7.1 3.72 14.96l6.55 5.09C12.02 14.02 17.56 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.5 24.5c0-1.64-.15-3.22-.42-4.75H24v9.01h12.64c-.55 2.93-2.2 5.41-4.68 7.08l7.18 5.58C43.44 37.3 46.5 31.38 46.5 24.5z"/>
                  <path fill="#FBBC05" d="M10.27 28.05A14.53 14.53 0 0 1 9.5 24c0-1.41.24-2.77.65-4.05L3.6 14.86A22.93 22.93 0 0 0 1.5 24c0 3.27.68 6.38 1.9 9.2l6.87-5.15z"/>
                  <path fill="#34A853" d="M24 46.5c5.22 0 9.6-1.72 12.8-4.68l-7.18-5.58c-1.73 1.16-3.95 1.84-5.62 1.84-6.44 0-11.98-4.52-13.73-10.55l-6.55 5.09C7.06 40.9 14.82 46.5 24 46.5z"/>
                  <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
                Sign Up with Google
              </button>

              <div className="auth-divider"><span>or create an account with email</span></div>

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
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Create a password"
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(event) => handleRememberEmailChange(event.target.checked)}
                  />
                  Remember email on this device
                </label>
              </div>

              <button type="button" className="primary-btn" onClick={handleRegister}>
                <Icon name="userPlus" /> Create Account
              </button>
            </>
          )}

          {authMode === "reset" && (
            <>
              <button type="button" className="back-btn" onClick={() => setAuthMode("signin")}>
                ← Back to Sign In
              </button>
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
              </div>
              <button type="button" className="primary-btn" onClick={handleResetPassword}>
                <Icon name="mail" /> Send Reset Link
              </button>
            </>
          )}

          {authError && <div className="banner error">{authError}</div>}
        </section>
        <VersionFooter />
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="status-screen">
        Loading your Firestore data...
        <VersionFooter />
      </div>
    );
  }

  const userLabel = state.account.fullName.trim() || user.displayName || user.email || user.uid;
  const userInitial = userLabel.trim().charAt(0).toUpperCase() || "?";
  const hasPasswordProvider = user.providerData.some((provider) => provider.providerId === "password");

  return (
    <div className="app-shell">
      <header className="topbar topbar-authenticated">
        <div className="topbar-brand">
          <span className="topbar-brand-mark" aria-hidden="true">🎓</span>
          <h1>Degree GPA Calculator</h1>
        </div>
        <div className="topbar-actions">
          <button type="button" className="user-chip" title="Account settings" aria-label="Account settings" onClick={openAccount}>
            <span className="user-chip-avatar" aria-hidden="true">{userInitial}</span>
            <span className="user-chip-name">{userLabel}</span>
          </button>

          <button
            type="button"
            className="icon-btn"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1zm0 17a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0v-2a1 1 0 0 1 1-1zM3 11h2a1 1 0 0 1 0 2H3a1 1 0 0 1 0-2zm16 0h2a1 1 0 0 1 0 2h-2a1 1 0 0 1 0-2zM5.64 4.22 7.05 5.64a1 1 0 0 1-1.41 1.41L4.22 5.64a1 1 0 0 1 1.42-1.42zm11.31 12.73 1.41 1.41a1 1 0 0 1-1.41 1.42l-1.42-1.42a1 1 0 0 1 1.42-1.41zM18.36 4.22a1 1 0 0 1 1.42 1.42l-1.42 1.41a1 1 0 0 1-1.41-1.41zM7.05 18.36a1 1 0 0 1-1.41 1.42l-1.42-1.42a1 1 0 0 1 1.42-1.41z"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.64 13a9 9 0 1 1-10.63-10.6 1 1 0 0 1 1.15 1.34 7 7 0 0 0 8.14 8.11 1 1 0 0 1 1.34 1.15z"
                />
              </svg>
            )}
          </button>

          <div className="menu-wrap" ref={dataMenuRef}>
            <button
              type="button"
              className={isDataMenuOpen ? "icon-btn is-active" : "icon-btn"}
              title="Data and backups"
              aria-label="Data and backups"
              aria-haspopup="menu"
              aria-expanded={isDataMenuOpen}
              onClick={() => setIsDataMenuOpen((prev) => !prev)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"
                />
              </svg>
            </button>
            {isDataMenuOpen && (
              <div className="menu-popup" role="menu">
                <button type="button" className="menu-item" role="menuitem" onClick={() => runFromMenu(handleDownloadBackup)}>
                  <Icon name="download" /> Download Backup (JSON)
                </button>
                <button type="button" className="menu-item" role="menuitem" onClick={() => runFromMenu(handleExportExcel)}>
                  <Icon name="sheet" /> Export To Excel
                </button>
                <label className="menu-item" role="menuitem">
                  <Icon name="upload" /> Upload Backup (JSON)
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => {
                      setIsDataMenuOpen(false);
                      handleUploadBackup(event);
                    }}
                  />
                </label>
                <div className="menu-separator" />
                <div className="menu-footnote">
                  Last modified: {new Date(state.lastModified).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="icon-btn danger"
            title="Sign out"
            aria-label="Sign out"
            onClick={handleSignOutUser}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M13 3h-2v10h2V3zm4.83 2.17-1.42 1.41A7 7 0 1 1 7.6 6.6L6.17 5.17a9 9 0 1 0 11.66 0z"
              />
            </svg>
          </button>
        </div>
      </header>

      {loadError && <div className="banner warning">{loadError}</div>}
      {saveError && <div className="banner error">{saveError}</div>}
      {importError && <div className="banner error">{importError}</div>}
      {importSuccess && <div className="banner success">{importSuccess}</div>}
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
                      <button type="button" className="icon-btn is-primary" title="Save name" aria-label="Save name" onClick={saveEditProfile}>
                        <Icon name="check" />
                      </button>
                      <button type="button" className="icon-btn" title="Cancel" aria-label="Cancel" onClick={() => setEditingProfileId(null)}>
                        <Icon name="x" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button type="button" className="profile-name" onClick={() => handleSwitchProfile(profile.id)}>
                        {profile.name}
                      </button>
                      <div className="actions-inline">
                        <button type="button" className="icon-btn" title="Rename profile" aria-label={`Rename ${profile.name}`} onClick={() => beginEditProfile(profile)}>
                          <Icon name="pencil" />
                        </button>
                        <button type="button" className="icon-btn danger" title="Delete profile" aria-label={`Delete ${profile.name}`} onClick={() => handleDeleteProfile(profile.id)}>
                          <Icon name="trash" />
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
              <div className="course-search-bar">
                <div className="course-search">
                  <input
                    type="search"
                    placeholder="Search courses across all semesters…"
                    aria-label="Search courses across all semesters"
                    value={courseSearchQuery}
                    onChange={(event) => setCourseSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setCourseSearchQuery("");
                    }}
                  />
                  {isSearching && (
                    <button type="button" className="neutral" onClick={() => setCourseSearchQuery("")}>
                      <Icon name="x" /> Clear
                    </button>
                  )}
                </div>
                <button type="button" className="add-semester-btn" onClick={() => setIsAddSemesterOpen(true)}>
                  <Icon name="plus" /> Add Semester
                </button>
              </div>
              {isSearching && (
                <div className="search-summary">
                  {searchMatchCount === 0
                    ? `No course matches "${courseSearchQuery.trim()}".`
                    : `${searchMatchCount} course(s) in ${searchMatchesBySemester.size} semester(s).`}
                </div>
              )}

              {!isSearching && (
                <>
              <div className="stats-grid">
                <article className="stat-card">
                  <h3>
                    <span className="stat-title-icon" aria-hidden="true">📈</span>
                    Overall GPA
                  </h3>
                  <div className="metric">{formatGpa(overallGpa)}</div>
                </article>
                <article className="stat-card">
                  <h3>
                    <span className="stat-title-icon" aria-hidden="true">🧮</span>
                    Total Earned Credits
                  </h3>
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
                </>
              )}

              <section className="below-overall-block binary-simulator">
                <h3>Binary Pass Simulator</h3>
                <p className="muted">
                  See what your overall GPA would become if a course were switched to pass/fail. Opens in a panel you can
                  drag aside while you browse.
                </p>
                <div className="actions-inline">
                  <button type="button" onClick={() => setSimulatorMode("open")}>
                    <Icon name="calculator" /> Open Simulator
                  </button>
                </div>
              </section>

      {simulatorMode === "tab" && (
        <button type="button" className="sim-tab" onClick={() => setSimulatorMode("open")}>
          <Icon name="calculator" /> Binary Simulator
        </button>
      )}

      {simulatorMode === "open" && (
        <div
          className={isDraggingSim ? "sim-panel is-dragging" : "sim-panel"}
          ref={simPanelRef}
          role="dialog"
          aria-label="Binary Pass Simulator"
          style={simPos ? { left: `${simPos.x}px`, top: `${simPos.y}px`, right: "auto", bottom: "auto" } : undefined}
        >
          <div
            className="sim-panel-header"
            onPointerDown={handleSimDragStart}
            onPointerMove={handleSimDragMove}
            onPointerUp={handleSimDragEnd}
            onPointerCancel={handleSimDragEnd}
          >
            <span className="sim-panel-grip" aria-hidden="true">
              <Icon name="drag" />
            </span>
            <span className="sim-panel-title">Binary Pass Simulator</span>
            <button type="button" className="icon-btn" title="Hide to side" aria-label="Hide to side" onClick={() => setSimulatorMode("tab")}>
              <Icon name="minimize" />
            </button>
            <button type="button" className="icon-btn" title="Close" aria-label="Close" onClick={() => setSimulatorMode("closed")}>
              <Icon name="x" />
            </button>
          </div>

          <div className="sim-panel-body">
                {overallGpa === null ? (
                  <div className="muted">Overall GPA is not available yet.</div>
                ) : coursesBelowOverall.length === 0 ? (
                  <div className="muted">No non-binary courses are below your current overall GPA ({formatGpa(overallGpa)}).</div>
                ) : (
                  <>
                    <div className="sim-summary">
                      <div className="sim-tile">
                        <span className="sim-tile-label">Current GPA</span>
                        <strong className="sim-tile-value">{formatGpa(overallGpa)}</strong>
                      </div>
                      <div className="sim-tile">
                        <span className="sim-tile-label">Simulated GPA</span>
                        <strong className="sim-tile-value">
                          {formatGpa(simulatedOverallGpa)}
                          <span className={deltaClassName(simulatedDelta)}>{formatDelta(simulatedDelta)}</span>
                        </strong>
                        <span className="sim-tile-note">
                          {selectedWorstCourses.length === 0
                            ? "Nothing selected yet"
                            : `${selectedWorstCourses.length} course(s) as binary`}
                        </span>
                      </div>
                      <div className="sim-tile">
                        <span className="sim-tile-label">Binary credits</span>
                        <strong className="sim-tile-value">
                          {projectedBinaryCredits.toFixed(1)}
                          {binaryCreditCap !== null && <span className="sim-tile-suffix">/ {binaryCreditCap.toFixed(1)}</span>}
                        </strong>
                        <span className="sim-tile-note">
                          {existingBinaryCredits.toFixed(1)} already binary + {selectedBinaryCredits.toFixed(1)} selected
                        </span>
                      </div>
                      <label className="sim-tile sim-cap">
                        <span className="sim-tile-label">Credit cap</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="No limit"
                          value={binaryCreditCap ?? ""}
                          onChange={(event) => handleBinaryCreditCapChange(event.target.value)}
                        />
                        <span className="sim-tile-note">Leave empty if your degree has no limit</span>
                      </label>
                    </div>

                    {isOverBinaryCap && (
                      <div className="banner warning">
                        This selection uses {projectedBinaryCredits.toFixed(1)} binary credits, which is{" "}
                        {(projectedBinaryCredits - (binaryCreditCap ?? 0)).toFixed(1)} over your cap of{" "}
                        {(binaryCreditCap ?? 0).toFixed(1)}.
                      </div>
                    )}
                    {simulatedOverallGpa === null && (
                      <div className="banner warning">
                        No graded credits would be left, so an overall GPA cannot be calculated for this selection.
                      </div>
                    )}

                    <details className="worst-semester-filter">
                      <summary>
                        Filter semesters ({selectedSemesterFilterCount} of {sortedActiveSemesters.length} shown)
                      </summary>
                      <div className="actions-inline">
                        <button type="button" className="neutral" onClick={() => setAllWorstSemesters(true)}>
                          <Icon name="check" /> Select All
                        </button>
                        <button type="button" className="neutral" onClick={() => setAllWorstSemesters(false)}>
                          <Icon name="x" /> Clear All
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
                    </details>

                    {topWorstCourses.length === 0 ? (
                      <div className="muted">No matching courses for the selected semesters.</div>
                    ) : (
                      <>
                        <div className="sim-sort">
                          <span className="sim-sort-label">Sort by</span>
                          {BINARY_SORT_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={binarySortMode === option.value ? "sim-sort-option is-active" : "sim-sort-option"}
                              onClick={() => setBinarySortMode(option.value)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>

                        <div className="insight-table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Binary</th>
                                <th>#</th>
                                <th>Course</th>
                                <th>When</th>
                                <th>Grade</th>
                                <th>Credits</th>
                                <th>Impact</th>
                                <th>If only this one</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleWorstCourses.map((course, index) => (
                                <tr
                                  key={course.key}
                                  className={`year-row-tone-${((course.academicYear - 1) % 6) + 1}${
                                    selectedWorstCourseByKey[course.key] ? " is-selected" : ""
                                  }`}
                                >
                                  <td>
                                    <input
                                      type="checkbox"
                                      aria-label={`Simulate ${course.courseName} as binary pass`}
                                      checked={selectedWorstCourseByKey[course.key] ?? false}
                                      onChange={(event) =>
                                        toggleWorstCourseSelection(course.semesterId, course.courseId, event.target.checked)
                                      }
                                    />
                                  </td>
                                  <td>{index + 1}</td>
                                  <td>{course.courseName}</td>
                                  <td className="sim-when">
                                    Y{course.academicYear} · S{course.semesterNumber} · {course.season}
                                  </td>
                                  <td>{course.grade}</td>
                                  <td>{course.credits.toFixed(1)}</td>
                                  <td>{course.impactScore.toFixed(2)}</td>
                                  <td>
                                    {formatGpa(course.soloGpa)}
                                    <span className={deltaClassName(course.soloDelta)}>{formatDelta(course.soloDelta)}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="actions-inline">
                          {topWorstCourses.length > 5 && (
                            <button
                              type="button"
                              className="neutral"
                              onClick={() => setShowAllWorstCourses((prev) => !prev)}
                            >
                              <Icon name={showAllWorstCourses ? "collapse" : "expand"} />
                              {showAllWorstCourses ? "Show Top 5" : `Show All (${topWorstCourses.length})`}
                            </button>
                          )}
                          <button
                            type="button"
                            className="neutral"
                            disabled={selectedWorstCourses.length === 0}
                            onClick={() => setSelectedWorstCourseByKey({})}
                          >
                            <Icon name="eraser" /> Clear Selection
                          </button>
                          <button
                            type="button"
                            disabled={selectedWorstCourses.length === 0}
                            onClick={applySelectedAsBinary}
                          >
                            <Icon name="apply" />
                            Apply {selectedWorstCourses.length > 0 ? `${selectedWorstCourses.length} ` : ""}as Binary
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
          </div>
        </div>
      )}

              <section className="semesters-list">
                {!isSearching && (
                  <div className="actions-inline">
                    <button
                      type="button"
                      className="neutral"
                      disabled={!canCollapseAll}
                      onClick={collapseAllSemesters}
                    >
                      <Icon name="collapse" /> Collapse All
                    </button>
                    <button
                      type="button"
                      className="neutral"
                      disabled={!canExpandAll}
                      onClick={showAllSemesters}
                    >
                      <Icon name="expand" /> Expand All
                    </button>
                  </div>
                )}
                {visibleYearGroups.map((group) => {
                  const yearToneClass = `year-tone-${((group.year - 1) % 6) + 1}`;
                  const yearExpanded = isYearExpanded(group.year, group.matchCount);
                  const yearBodyId = `year_body_${group.year}`;

                  return (
                    <div key={group.year} className={`year-group ${yearToneClass}`}>
                      <button
                        type="button"
                        className="year-group-header"
                        aria-expanded={yearExpanded}
                        aria-controls={yearBodyId}
                        disabled={isSearching}
                        onClick={() => toggleYearCollapsed(group.year)}
                      >
                        <span className={yearExpanded ? "chevron is-open" : "chevron"} aria-hidden="true">
                          ▸
                        </span>
                        <span className="group-title">Academic Year {group.year}</span>
                        <span className="chip">{group.semesters.length} semester(s)</span>
                        <span className="chip">{group.courseCount} course(s)</span>
                        <span className="chip">{group.credits.toFixed(1)} credits</span>
                        <span className="gpa-pill">GPA {formatGpa(group.gpa)}</span>
                      </button>
                      <div id={yearBodyId} className={yearExpanded ? "collapsible is-open" : "collapsible"}>
                        <div className="collapsible-inner">
                          <div className="year-group-body">
                            {group.semesters.map((semester) => {
                              const semesterGpa = calculateSemesterGpa(semester.courses);
                              const isEditingSemester = editingSemesterId === semester.id;
                              const isExpanded = isSemesterExpanded(semester.id);
                              const semesterMatches = searchMatchesBySemester.get(semester.id);
                              const summary = summarizeCourses(semester.courses);
                              const semesterBodyId = `semester_body_${semester.id}`;

                              return (
                                <article
                                  key={semester.id}
                                  className={`semester-card ${yearToneClass}`}
                                  ref={(node) => {
                                    semesterNodeRefs.current[semester.id] = node;
                                  }}
                                >
                                  <div className="semester-head">
                                    <button
                                      type="button"
                                      className="semester-toggle"
                                      aria-expanded={isExpanded}
                                      aria-controls={semesterBodyId}
                                      disabled={isSearching}
                                      onClick={() => toggleSemesterCollapsed(semester.id)}
                                    >
                                      <span className={isExpanded ? "chevron is-open" : "chevron"} aria-hidden="true">
                                        ▸
                                      </span>
                                      <span className="group-title">
                                        Semester {semester.semesterNumber} | {semester.season}
                                      </span>
                                      <span className="chip">{summary.count} course(s)</span>
                                      <span className="chip">{summary.credits.toFixed(1)} credits</span>
                                      {semesterMatches && (
                                        <span className="chip is-hit">{semesterMatches.size} match(es)</span>
                                      )}
                                      <span className="gpa-pill">GPA {formatGpa(semesterGpa)}</span>
                                    </button>
                                    {isExpanded && (
                                      <div className="semester-actions actions-inline">
                                        <button type="button" onClick={() => openAddCourse(semester.id)}>
                                          <Icon name="plus" /> Add Course
                                        </button>
                                        {isEditingSemester ? (
                                          <>
                                            <button type="button" onClick={() => saveEditSemester(activeProfile.id, semester.id)}>
                                              <Icon name="check" /> Save Semester
                                            </button>
                                            <button type="button" className="neutral" onClick={cancelEditSemester}>
                                              <Icon name="x" /> Cancel
                                            </button>
                                            <button
                                              type="button"
                                              className="danger"
                                              onClick={() => handleDeleteSemester(activeProfile.id, semester.id)}
                                            >
                                              <Icon name="trash" /> Remove Semester
                                            </button>
                                          </>
                                        ) : (
                                          <button type="button" className="neutral" onClick={() => beginEditSemester(semester)}>
                                            <Icon name="pencil" /> Edit Semester
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div
                                    id={semesterBodyId}
                                    className={isExpanded ? "collapsible is-open" : "collapsible"}
                                  >
                                    <div className="collapsible-inner">
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

                          <div className="courses-table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th className="col-num">#</th>
                                  <th>Code</th>
                                  <th>Course</th>
                                  <th>Credits</th>
                                  <th>Grade</th>
                                  <th>Binary</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {semester.courses.map((course, courseIndex) => {
                                  const isEditing = editingCourseId === course.id;
                                  const isHit = semesterMatches?.has(course.id) ?? false;
                                  const rowClass = [isHit ? "row-hit" : "", isEditing ? "row-editing" : ""]
                                    .filter(Boolean)
                                    .join(" ");
                                  return (
                                    <tr key={course.id} className={rowClass || undefined}>
                                      <td className="col-num">{courseIndex + 1}</td>
                                      {isEditing ? (
                                        <>
                                          <td>
                                            <input type="text" value={editingCourseDraft.code} onChange={(event) => setEditingCourseDraft((prev) => ({ ...prev, code: event.target.value }))} />
                                          </td>
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
                                              value={editingCourseDraft.grade}
                                              onChange={(event) => setEditingCourseDraft((prev) => ({ ...prev, grade: event.target.value }))}
                                            />
                                          </td>
                                          <td>
                                            <input
                                              type="checkbox"
                                              checked={editingCourseDraft.isBinaryPass}
                                              onChange={(event) => setEditingCourseDraft((prev) => ({ ...prev, isBinaryPass: event.target.checked }))}
                                            />
                                          </td>
                                          <td>
                                            <div className="actions-inline">
                                              <button type="button" className="icon-btn is-primary" title="Save changes" aria-label="Save changes" onClick={() => saveEditCourse(activeProfile.id, semester.id)}>
                                                <Icon name="check" />
                                              </button>
                                              <button type="button" className="icon-btn" title="Cancel" aria-label="Cancel" onClick={cancelEditCourse}>
                                                <Icon name="x" />
                                              </button>
                                              <button type="button" className="icon-btn danger" title="Delete course" aria-label="Delete course" onClick={() => handleDeleteCourse(activeProfile.id, semester.id, course.id)}>
                                                <Icon name="trash" />
                                              </button>
                                            </div>
                                            {courseFormError && <div className="form-error">{courseFormError}</div>}
                                          </td>
                                        </>
                                      ) : (
                                        <>
                                          <td className="course-code">
                                            {course.code ? highlightMatch(course.code, normalizedSearchQuery) : "—"}
                                          </td>
                                          <td>{highlightMatch(course.name, normalizedSearchQuery)}</td>
                                          <td>{course.credits.toFixed(1)}</td>
                                          <td>{course.grade === null ? "N/A" : course.grade}</td>
                                          <td>{course.isBinaryPass ? "Yes" : "No"}</td>
                                          <td>
                                            <div className="actions-inline">
                                              <button type="button" className="icon-btn" title="Edit course" aria-label={`Edit ${course.name}`} onClick={() => beginEditCourse(course)}>
                                                <Icon name="pencil" />
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
                                    <td colSpan={7} className="muted center">
                                      No courses in this semester yet.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {sortedActiveSemesters.length === 0 && <div className="empty">No semesters yet. Add the first one above.</div>}
                {isSearching && searchMatchCount === 0 && sortedActiveSemesters.length > 0 && (
                  <div className="empty">No course name or code contains "{courseSearchQuery.trim()}".</div>
                )}
              </section>
            </>
          )}
        </section>
      </main>

      {addCourseSemesterId && activeProfile && (() => {
        const semesterId = addCourseSemesterId;
        const semester = activeProfile.semesters.find((item) => item.id === semesterId);
        const draft = courseDraftBySemester[semesterId] ?? EMPTY_COURSE_DRAFT;
        const invalidReason = validateCourseDraft(draft);

        return (
          <div
            className="modal-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeAddCourse();
            }}
          >
            <div className="modal-dialog modal-wide" role="dialog" aria-modal="true" aria-labelledby="add-course-title">
              <h3 id="add-course-title">
                Add Course
                {semester && (
                  <span className="modal-subtitle">
                    Year {semester.academicYear} · Semester {semester.semesterNumber} · {semester.season}
                  </span>
                )}
              </h3>

              <div className="row-fields compact">
                <label>
                  Code <span className="field-optional">(optional)</span>
                  <input
                    type="text"
                    placeholder="e.g. 104013"
                    value={draft.code}
                    onChange={(event) => handleCourseDraftChange(semesterId, { code: event.target.value })}
                  />
                </label>
                <label>
                  Name <span className="field-required">*</span>
                  <input
                    type="text"
                    autoFocus
                    ref={(node) => {
                      courseNameInputRefs.current[semesterId] = node;
                    }}
                    value={draft.name}
                    onChange={(event) => handleCourseDraftChange(semesterId, { name: event.target.value })}
                  />
                </label>
                <label>
                  Credits <span className="field-required">*</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={draft.credits}
                    onChange={(event) => handleCourseDraftChange(semesterId, { credits: event.target.value })}
                  />
                </label>
                <label>
                  Grade (0-100) {!draft.isBinaryPass && <span className="field-required">*</span>}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    disabled={draft.isBinaryPass}
                    value={draft.grade}
                    onChange={(event) => handleCourseDraftChange(semesterId, { grade: event.target.value })}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={draft.isBinaryPass}
                    onChange={(event) =>
                      handleCourseDraftChange(semesterId, {
                        isBinaryPass: event.target.checked,
                        ...(event.target.checked ? { grade: "" } : {})
                      })
                    }
                  />
                  Binary Pass (Pass/Fail)
                </label>
              </div>

              {courseFormErrorBySemester[semesterId] && (
                <div className="form-error">{courseFormErrorBySemester[semesterId]}</div>
              )}

              <div className="modal-actions">
                {addCourseAddedCount > 0 && (
                  <span className="modal-note">
                    {addCourseAddedCount} course{addCourseAddedCount === 1 ? "" : "s"} added
                  </span>
                )}
                <button type="button" className="neutral" onClick={closeAddCourse}>
                  <Icon name="check" /> Done
                </button>
                <button
                  type="button"
                  disabled={invalidReason !== null}
                  title={invalidReason ?? undefined}
                  onClick={() => handleAddCourse(activeProfile.id, semesterId)}
                >
                  <Icon name="plus" /> Add Course
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {isAddSemesterOpen && activeProfile && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsAddSemesterOpen(false);
          }}
        >
          <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="add-semester-title">
            <h3 id="add-semester-title">Add Semester</h3>
            <div className="row-fields">
              <label>
                Year
                <input
                  type="number"
                  min={1}
                  step={1}
                  autoFocus
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
            </div>
            <div className="modal-actions">
              <button type="button" className="neutral" onClick={() => setIsAddSemesterOpen(false)}>
                <Icon name="x" /> Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAddSemester(activeProfile.id);
                  setIsAddSemesterOpen(false);
                }}
              >
                <Icon name="plus" /> Add Semester
              </button>
            </div>
          </div>
        </div>
      )}

      {isAccountOpen && accountDraft && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeAccount();
          }}
        >
          <div className="modal-dialog modal-wide account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
            <div className="account-header">
              <span className="account-avatar" aria-hidden="true">{userInitial}</span>
              <div>
                <h3 id="account-title">Account &amp; Profile</h3>
                <span className="modal-subtitle">
                  {hasPasswordProvider ? "Email & password account" : "Signed in with Google"}
                </span>
              </div>
            </div>

            {accountError && <div className="banner error">{accountError}</div>}
            {accountSuccess && <div className="banner success">{accountSuccess}</div>}

            <section className="account-section">
              <h4>Personal details</h4>
              <div className="account-grid">
                <label>
                  Display name
                  <input
                    type="text"
                    autoComplete="nickname"
                    value={accountDraft.displayName}
                    onChange={(event) => patchAccountDraft({ displayName: event.target.value })}
                    placeholder="Shown across the app"
                  />
                </label>
                <label>
                  Full legal name
                  <input
                    type="text"
                    autoComplete="name"
                    value={accountDraft.fullName}
                    onChange={(event) => patchAccountDraft({ fullName: event.target.value })}
                    placeholder="As it appears on transcripts"
                  />
                </label>
                <label>
                  Institution
                  <input
                    type="text"
                    autoComplete="organization"
                    value={accountDraft.institution}
                    onChange={(event) => patchAccountDraft({ institution: event.target.value })}
                    placeholder="University or college"
                  />
                </label>
                <label>
                  Degree / programme
                  <input
                    type="text"
                    value={accountDraft.degreeProgram}
                    onChange={(event) => patchAccountDraft({ degreeProgram: event.target.value })}
                    placeholder="e.g. BSc Computer Science"
                  />
                </label>
                <label>
                  Student ID <span className="field-optional">optional</span>
                  <input
                    type="text"
                    value={accountDraft.studentId}
                    onChange={(event) => patchAccountDraft({ studentId: event.target.value })}
                  />
                </label>
                <label>
                  Expected graduation year <span className="field-optional">optional</span>
                  <input
                    type="number"
                    min={1900}
                    max={2200}
                    step={1}
                    value={accountDraft.expectedGraduationYear}
                    onChange={(event) => patchAccountDraft({ expectedGraduationYear: event.target.value })}
                  />
                </label>
                <label>
                  Target GPA <span className="field-optional">optional</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={accountDraft.targetGpa}
                    onChange={(event) => patchAccountDraft({ targetGpa: event.target.value })}
                  />
                </label>
                <label>
                  Credits required for degree <span className="field-optional">optional</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={accountDraft.requiredCredits}
                    onChange={(event) => patchAccountDraft({ requiredCredits: event.target.value })}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" disabled={accountBusy} onClick={handleSaveAccount}>
                  <Icon name="check" /> Save details
                </button>
              </div>
            </section>

            {hasPasswordProvider ? (
              <>
                <section className="account-section">
                  <h4>Email address</h4>
                  <div className="account-grid">
                    <label>
                      Email
                      <input
                        type="email"
                        autoComplete="email"
                        value={accountDraft.email}
                        onChange={(event) => patchAccountDraft({ email: event.target.value })}
                      />
                    </label>
                  </div>
                  <p className="account-hint">
                    Changing this sends a verification link to the new address. The change applies only after you confirm it.
                    Your current password is required below.
                  </p>
                  <div className="modal-actions">
                    <button type="button" className="neutral" disabled={accountBusy} onClick={handleChangeEmail}>
                      <Icon name="mail" /> Send verification
                    </button>
                  </div>
                </section>

                <section className="account-section">
                  <h4>Password</h4>
                  <div className="account-grid">
                    <label>
                      Current password
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={passwordDraft.current}
                        onChange={(event) => setPasswordDraft((prev) => ({ ...prev, current: event.target.value }))}
                      />
                    </label>
                    <label>
                      New password
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={passwordDraft.next}
                        onChange={(event) => setPasswordDraft((prev) => ({ ...prev, next: event.target.value }))}
                      />
                    </label>
                    <label>
                      Confirm new password
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={passwordDraft.confirm}
                        onChange={(event) => setPasswordDraft((prev) => ({ ...prev, confirm: event.target.value }))}
                      />
                    </label>
                  </div>
                  <p className="account-hint">At least {MIN_PASSWORD_LENGTH} characters.</p>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="neutral"
                      disabled={accountBusy || !passwordDraft.current || !passwordDraft.next}
                      onClick={handleChangePassword}
                    >
                      <Icon name="check" /> Update password
                    </button>
                  </div>
                </section>
              </>
            ) : (
              <section className="account-section">
                <h4>Sign-in method</h4>
                <p className="account-hint">
                  This account signs in with Google ({user.email}). Email and password are managed in your Google account.
                </p>
              </section>
            )}

            <div className="modal-actions">
              <button type="button" className="neutral" onClick={closeAccount}>
                <Icon name="x" /> Close
              </button>
            </div>
          </div>
        </div>
      )}

      <VersionFooter />
    </div>
  );
}

function VersionFooter() {
  return (
    <footer className="app-version" title={`Commit ${__GIT_COMMIT__} · built ${__BUILD_DATE__}`}>
      v{__APP_VERSION__} · {__GIT_COMMIT__} · {__BUILD_DATE__}
    </footer>
  );
}