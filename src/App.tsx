import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
  calculateAnnualGpas,
  calculateOverallGpa,
  calculateSemesterGpa,
  calculateTotalEarnedCredits,
  formatGpa
} from "@/calculations";
import { auth, firebaseInitError, googleProvider } from "@/firebase";
import {
  buildDefaultState,
  isValidImportedState,
  loadUserAppState,
  normalizeState,
  saveUserAppState
} from "@/firebase-state";
import { createId, type Account, type AppState, type Course, type Profile, type Semester } from "@/types";
import {
  EMPTY_COURSE_DRAFT,
  EMPTY_PASSWORD_DRAFT,
  EMPTY_SEMESTER_DRAFT,
  MIN_PASSWORD_LENGTH,
  getNextSemesterDraft,
  numberToDraft,
  parseCourseDraft,
  parseOptionalNumber,
  sortSemesters,
  touch,
  validateCourseDraft,
  type AccountDraft,
  type CourseDraft,
  type PasswordDraft,
  type SemesterDraft
} from "@/lib/drafts";
import {
  describeAccountError,
  describeGoogleError,
  describeRegisterError,
  describeResetError,
  describeSignInError,
  errorCode
} from "@/lib/auth-errors";
import { seasonLabel, t } from "@/lib/i18n";
import { useAppearance } from "@/hooks/useAppearance";
import { useSemesterBrowser } from "@/hooks/useSemesterBrowser";
import { useSimulator } from "@/hooks/useSimulator";
import { useViewTransition } from "@/hooks/useViewTransition";
import { AuthScreen, type AuthMode } from "@/components/auth/AuthScreen";
import { StatusScreen, VersionFooter } from "@/components/layout/StatusScreen";
import { TopBar } from "@/components/layout/TopBar";
import { ProfilesPanel } from "@/components/profiles/ProfilesPanel";
import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { AddCourseSheet, AddSemesterSheet } from "@/components/dialogs/AddSheets";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import { Banner } from "@/components/ui/surface";

const REMEMBERED_EMAIL_KEY = "gpa_tracker_remembered_email";

export default function App() {
  const { appearance, setAppearance, patchAppearance, resolvedMode, toggleMode } = useAppearance();
  const startViewTransition = useViewTransition();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [state, setState] = useState<AppState>(buildDefaultState());
  const [view, setView] = useState<"dashboard" | "settings">("dashboard");

  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(() => Boolean(localStorage.getItem(REMEMBERED_EMAIL_KEY)));

  const [semesterDraftByProfile, setSemesterDraftByProfile] = useState<Record<string, SemesterDraft>>({});
  const [courseDraftBySemester, setCourseDraftBySemester] = useState<Record<string, CourseDraft>>({});
  const [courseFormErrorBySemester, setCourseFormErrorBySemester] = useState<Record<string, string | null>>({});
  const [isAddSemesterOpen, setIsAddSemesterOpen] = useState(false);
  const [addCourseSemesterId, setAddCourseSemesterId] = useState<string | null>(null);
  const [addCourseAddedCount, setAddCourseAddedCount] = useState(0);
  const [focusSemesterId, setFocusSemesterId] = useState<string | null>(null);

  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null);
  const [editingSemesterDraft, setEditingSemesterDraft] = useState<SemesterDraft>(EMPTY_SEMESTER_DRAFT);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseDraft, setEditingCourseDraft] = useState<CourseDraft>(EMPTY_COURSE_DRAFT);
  const [courseFormError, setCourseFormError] = useState<string | null>(null);

  const [accountDraft, setAccountDraft] = useState<AccountDraft | null>(null);
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft>(EMPTY_PASSWORD_DRAFT);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);

  const [simulatorOpen, setSimulatorOpen] = useState(false);

  const [authError, setAuthError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<AuthCredential | null>(null);
  const [pendingGoogleEmail, setPendingGoogleEmail] = useState<string | null>(null);

  const previousSerializedRef = useRef<string>("");
  const hasLoadedUserStateRef = useRef(false);
  const editingCourseOriginalRef = useRef<CourseDraft | null>(null);
  const semesterNodeRefs = useRef<Record<string, HTMLElement | null>>({});
  const courseNameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const activeProfile = useMemo(
    () => state.profiles.find((profile) => profile.id === state.activeProfileId) ?? null,
    [state.activeProfileId, state.profiles]
  );

  const annualGpas = useMemo(() => (activeProfile ? calculateAnnualGpas(activeProfile) : {}), [activeProfile]);
  const overallGpa = activeProfile ? calculateOverallGpa(activeProfile) : null;
  const totalCredits = activeProfile ? calculateTotalEarnedCredits(activeProfile) : 0;

  const browser = useSemesterBrowser(activeProfile, annualGpas);
  const simulator = useSimulator(activeProfile, overallGpa, browser.sortedSemesters);

  function setMutatingState(mutator: (prev: AppState) => AppState) {
    setState((prev) => touch(mutator(prev)));
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setAuthError(null);
      setLoadError(null);
      setImportError(null);
      setImportSuccess(null);
      setUser(nextUser);
      setAuthLoading(false);
      setView("dashboard");

      if (!nextUser) {
        hasLoadedUserStateRef.current = false;
        previousSerializedRef.current = "";
        setState(buildDefaultState());
        return;
      }

      setDataLoading(true);
      try {
        const normalized = normalizeState(await loadUserAppState(nextUser.uid));
        previousSerializedRef.current = JSON.stringify(normalized);
        hasLoadedUserStateRef.current = true;
        setState(normalized);
        setAppearance(normalized.appearance);
      } catch {
        const fallback = buildDefaultState();
        previousSerializedRef.current = JSON.stringify(fallback);
        hasLoadedUserStateRef.current = true;
        setState(fallback);
        setLoadError(t.errors.loadFailed);
      } finally {
        setDataLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setAppearance]);

  // Appearance lives in local storage first; Firestore mirrors it so it follows the account.
  useEffect(() => {
    if (!user || !hasLoadedUserStateRef.current) return;

    setState((prev) => {
      const alreadyMatches =
        prev.theme === resolvedMode &&
        prev.appearance.mode === appearance.mode &&
        prev.appearance.primaryId === appearance.primaryId &&
        prev.appearance.surfaceId === appearance.surfaceId;

      return alreadyMatches ? prev : touch({ ...prev, theme: resolvedMode, appearance });
    });
  }, [appearance, resolvedMode, user]);

  useEffect(() => {
    if (!rememberEmail) {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      return;
    }

    const trimmed = email.trim();
    if (trimmed) localStorage.setItem(REMEMBERED_EMAIL_KEY, trimmed);
  }, [email, rememberEmail]);

  useEffect(() => {
    if (!user || !hasLoadedUserStateRef.current) return;

    const serialized = JSON.stringify(state);
    if (serialized === previousSerializedRef.current) return;

    previousSerializedRef.current = serialized;
    setSaveError(null);

    void saveUserAppState(user.uid, state).catch(() => setSaveError(t.errors.saveFailed));
  }, [state, user]);

  useEffect(() => {
    if (!focusSemesterId) return;

    const frame = requestAnimationFrame(() => {
      semesterNodeRefs.current[focusSemesterId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      openAddCourse(focusSemesterId);
      setFocusSemesterId(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [focusSemesterId]);

  function goTo(nextView: "dashboard" | "settings") {
    startViewTransition(() => setView(nextView));
  }

  function openAddCourse(semesterId: string) {
    setCourseDraftBySemester((prev) => ({ ...prev, [semesterId]: { ...EMPTY_COURSE_DRAFT } }));
    setCourseFormErrorBySemester((prev) => ({ ...prev, [semesterId]: null }));
    setAddCourseAddedCount(0);
    setAddCourseSemesterId(semesterId);
  }

  async function handleGoogleSignIn() {
    try {
      setAuthError(null);
      setImportSuccess(null);
      googleProvider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (errorCode(error) === "auth/account-exists-with-different-credential") {
        const pendingCredential = GoogleAuthProvider.credentialFromError(error as Parameters<
          typeof GoogleAuthProvider.credentialFromError
        >[0]);
        const emailFromError =
          typeof error === "object" && error !== null && "customData" in error
            ? String((error as { customData?: { email?: string } }).customData?.email ?? "")
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
            setAuthError("לאימייל הזה כבר קיים חשבון עם סיסמה. התחבר עם הסיסמה פעם אחת כדי לקשר את Google.");
            return;
          }

          if (methods.length > 0) {
            setAuthError(`האימייל הזה כבר קיים עם: ${methods.join(", ")}. התחבר בשיטה הזו ואז נסה שוב עם Google.`);
            return;
          }
        }
      }

      setAuthError(describeGoogleError(error));
    }
  }

  async function handleEmailSignIn() {
    try {
      setAuthError(null);
      const normalizedEmail = email.trim().toLowerCase();
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);

      if (pendingGoogleCredential && pendingGoogleEmail && credential.user.email?.toLowerCase() === pendingGoogleEmail) {
        try {
          await linkWithCredential(credential.user, pendingGoogleCredential);
          setImportSuccess(t.errors.googleLinked);
        } catch (linkError) {
          if (errorCode(linkError) !== "auth/provider-already-linked") {
            setAuthError(describeAccountError(linkError));
          }
        } finally {
          setPendingGoogleCredential(null);
          setPendingGoogleEmail(null);
        }
      }
    } catch (error) {
      setAuthError(describeSignInError(error));
    }
  }

  async function handleRegister() {
    try {
      setAuthError(null);
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      setAuthError(describeRegisterError(error));
    }
  }

  async function handleResetPassword() {
    try {
      setAuthError(null);
      setImportError(null);
      if (!email.trim()) {
        setAuthError("הזן כתובת אימייל כדי לקבל קישור לאיפוס סיסמה.");
        return;
      }
      await sendPasswordResetEmail(auth, email.trim());
      setImportSuccess(t.errors.resetSent);
    } catch (error) {
      setAuthError(describeResetError(error));
    }
  }

  async function handleSignOutUser() {
    try {
      await signOut(auth);
    } catch {
      setAuthError(t.errors.signOutFailed);
    }
  }

  function openSettings() {
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
    goTo("settings");
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
      setAccountSuccess(t.settings.account.saved);
    } catch (error) {
      setAccountError(describeAccountError(error));
    } finally {
      setAccountBusy(false);
    }
  }

  async function handleChangePassword() {
    if (!user?.email) {
      setAccountError(t.errors.generic);
      return;
    }

    if (passwordDraft.next.length < MIN_PASSWORD_LENGTH) {
      setAccountError(`הסיסמה החדשה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים.`);
      return;
    }

    if (passwordDraft.next !== passwordDraft.confirm) {
      setAccountError("הסיסמה החדשה והאישור אינם תואמים.");
      return;
    }

    if (passwordDraft.next === passwordDraft.current) {
      setAccountError("הסיסמה החדשה חייבת להיות שונה מהנוכחית.");
      return;
    }

    setAccountBusy(true);
    setAccountError(null);
    setAccountSuccess(null);

    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, passwordDraft.current));
      await updatePassword(user, passwordDraft.next);
      setPasswordDraft(EMPTY_PASSWORD_DRAFT);
      setAccountSuccess(t.settings.account.passwordUpdated);
    } catch (error) {
      setAccountError(describeAccountError(error));
    } finally {
      setAccountBusy(false);
    }
  }

  async function handleChangeEmail() {
    if (!user?.email || !accountDraft) return;

    const nextEmail = accountDraft.email.trim();
    if (!nextEmail || nextEmail === user.email) {
      setAccountError("הזן כתובת אימייל אחרת תחילה.");
      return;
    }

    if (!passwordDraft.current) {
      setAccountError("הזן את הסיסמה הנוכחית כדי לאשר את שינוי האימייל.");
      return;
    }

    setAccountBusy(true);
    setAccountError(null);
    setAccountSuccess(null);

    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, passwordDraft.current));
      await verifyBeforeUpdateEmail(user, nextEmail);
      setAccountSuccess(t.settings.account.verificationSent(nextEmail));
    } catch (error) {
      setAccountError(describeAccountError(error));
    } finally {
      setAccountBusy(false);
    }
  }

  function handleDownloadBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
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

    const belowOverallRows = simulator.coursesBelowOverall.map((course) => ({
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
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        semesterRows.length > 0 ? semesterRows : [{ Profile: activeProfile.name, OverallGPA: formatGpa(overallGpa) }]
      ),
      "Courses"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        belowOverallRows.length > 0
          ? belowOverallRows
          : [{ Profile: activeProfile.name, OverallGPA: formatGpa(overallGpa) }]
      ),
      "Below Overall GPA"
    );

    const safeName =
      activeProfile.name
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, "_")
        .replace(/^_+|_+$/g, "") || "profile";
    XLSX.writeFile(workbook, `${safeName}_gpa_export.xlsx`);
  }

  async function handleUploadBackup(event: ChangeEvent<HTMLInputElement>) {
    setImportError(null);
    setImportSuccess(null);

    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      setImportError(t.errors.importInvalidFile);
      event.target.value = "";
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isValidImportedState(parsed)) {
        setImportError(t.errors.importInvalidSchema);
        event.target.value = "";
        return;
      }

      const normalized = normalizeState(parsed);
      previousSerializedRef.current = JSON.stringify(normalized);
      setState(normalized);
      setAppearance(normalized.appearance);

      if (user) await saveUserAppState(user.uid, normalized);

      setImportSuccess(t.errors.importSuccess);
    } catch {
      setImportError(t.errors.importParse);
    } finally {
      event.target.value = "";
    }
  }

  function handleCreateProfile(name: string) {
    const id = createId();
    const profile: Profile = { id, name, binaryCreditCap: null, semesters: [] };

    setMutatingState((prev) => ({
      ...prev,
      profiles: [...prev.profiles, profile],
      activeProfileId: prev.activeProfileId ?? id
    }));
  }

  function handleRenameProfile(id: string, name: string) {
    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) => (profile.id === id ? { ...profile, name } : profile))
    }));
  }

  function handleDeleteProfile(id: string) {
    const profile = state.profiles.find((item) => item.id === id);
    const semesterCount = profile?.semesters.length ?? 0;
    const courseCount = profile?.semesters.reduce((sum, semester) => sum + semester.courses.length, 0) ?? 0;

    const confirmed = window.confirm(
      `למחוק את הפרופיל "${profile?.name ?? id}"?\n\n${semesterCount} סמסטרים ו־${courseCount} קורסים יימחקו לצמיתות. לא ניתן לבטל.`
    );
    if (!confirmed) return;

    setMutatingState((prev) => {
      const remaining = prev.profiles.filter((item) => item.id !== id);
      const nextProfiles = remaining.length > 0 ? remaining : buildDefaultState().profiles;
      return {
        ...prev,
        profiles: nextProfiles,
        activeProfileId:
          prev.activeProfileId === id
            ? nextProfiles[0]?.id ?? null
            : prev.activeProfileId ?? nextProfiles[0]?.id ?? null
      };
    });

    setSemesterDraftByProfile((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }

  const activeSemesterDraft = semesterDraftByProfile[activeProfile?.id ?? ""] ?? getNextSemesterDraft(activeProfile);

  function handleSemesterDraftChange(patch: Partial<SemesterDraft>) {
    if (!activeProfile) return;
    const profileId = activeProfile.id;

    setSemesterDraftByProfile((prev) => {
      const next = { ...(prev[profileId] ?? getNextSemesterDraft(activeProfile)), ...patch };

      if (patch.academicYear !== undefined && patch.semesterNumber === undefined) {
        next.semesterNumber = String(activeProfile.semesters.length + 1);
        next.season = "Winter A";
      }

      return { ...prev, [profileId]: next };
    });
  }

  function handleAddSemester() {
    if (!activeProfile) return;

    const profileId = activeProfile.id;
    const draft = semesterDraftByProfile[profileId] ?? getNextSemesterDraft(activeProfile);
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
          ? { ...profile, semesters: sortSemesters([...profile.semesters, newSemester]) }
          : profile
      )
    }));

    const updatedProfile: Profile = {
      ...activeProfile,
      semesters: sortSemesters([...activeProfile.semesters, newSemester])
    };
    setSemesterDraftByProfile((prev) => ({ ...prev, [profileId]: getNextSemesterDraft(updatedProfile) }));

    // Drop the user straight into the new semester so courses can be added right away.
    browser.expandSemester(newSemester.id, academicYear);
    setIsAddSemesterOpen(false);
    setFocusSemesterId(newSemester.id);
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

  function saveEditSemester(semesterId: string) {
    if (!activeProfile || !editingSemesterId) return;

    const academicYear = Number(editingSemesterDraft.academicYear);
    const semesterNumber = Number(editingSemesterDraft.semesterNumber);

    if (!Number.isInteger(academicYear) || academicYear <= 0) return;
    if (!Number.isInteger(semesterNumber) || semesterNumber <= 0) return;

    const profileId = activeProfile.id;
    const patchSemester = (semester: Semester): Semester =>
      semester.id === semesterId
        ? { ...semester, academicYear, semesterNumber, season: editingSemesterDraft.season }
        : semester;

    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === profileId ? { ...profile, semesters: profile.semesters.map(patchSemester) } : profile
      )
    }));

    setSemesterDraftByProfile((prev) => ({
      ...prev,
      [profileId]: getNextSemesterDraft({ ...activeProfile, semesters: activeProfile.semesters.map(patchSemester) })
    }));

    cancelEditSemester();
  }

  function handleDeleteSemester(semesterId: string) {
    if (!activeProfile) return;

    const semester = activeProfile.semesters.find((item) => item.id === semesterId);
    if (!semester) return;

    const confirmed = window.confirm(
      t.semesters.deleteConfirm(
        semester.academicYear,
        semester.semesterNumber,
        seasonLabel(semester.season),
        semester.courses.length
      )
    );
    if (!confirmed) return;

    const profileId = activeProfile.id;
    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === profileId
          ? { ...profile, semesters: profile.semesters.filter((item) => item.id !== semesterId) }
          : profile
      )
    }));

    setCourseDraftBySemester((prev) => {
      const { [semesterId]: _removed, ...rest } = prev;
      return rest;
    });
    browser.forgetSemester(semesterId);

    if (editingSemesterId === semesterId) cancelEditSemester();
  }

  function handleCourseDraftChange(semesterId: string, patch: Partial<CourseDraft>) {
    setCourseDraftBySemester((prev) => ({
      ...prev,
      [semesterId]: { ...(prev[semesterId] ?? EMPTY_COURSE_DRAFT), ...patch }
    }));
  }

  function handleAddCourse(semesterId: string) {
    if (!activeProfile) return;

    const draft = courseDraftBySemester[semesterId] ?? EMPTY_COURSE_DRAFT;
    const validationError = validateCourseDraft(draft);
    if (validationError) {
      setCourseFormErrorBySemester((prev) => ({ ...prev, [semesterId]: validationError }));
      return;
    }

    const parsed = parseCourseDraft(draft);
    if (!parsed) return;

    setCourseFormErrorBySemester((prev) => ({ ...prev, [semesterId]: null }));

    const profileId = activeProfile.id;
    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              semesters: profile.semesters.map((semester) =>
                semester.id === semesterId
                  ? { ...semester, courses: [...semester.courses, { ...parsed, id: createId() }] }
                  : semester
              )
            }
          : profile
      )
    }));

    setCourseDraftBySemester((prev) => ({ ...prev, [semesterId]: { ...EMPTY_COURSE_DRAFT } }));

    // Sheet stays open so several courses can be entered in one pass.
    setAddCourseAddedCount((prev) => prev + 1);
    courseNameInputRefs.current[semesterId]?.focus();
  }

  function handleDeleteCourse(semesterId: string, courseId: string) {
    if (!activeProfile) return;

    const course = activeProfile.semesters
      .find((semester) => semester.id === semesterId)
      ?.courses.find((item) => item.id === courseId);

    if (!window.confirm(t.course.deleteConfirm(course?.name ?? courseId))) return;

    const profileId = activeProfile.id;
    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              semesters: profile.semesters.map((semester) =>
                semester.id === semesterId
                  ? { ...semester, courses: semester.courses.filter((item) => item.id !== courseId) }
                  : semester
              )
            }
          : profile
      )
    }));

    if (editingCourseId === courseId) {
      editingCourseOriginalRef.current = null;
      setEditingCourseId(null);
      setCourseFormError(null);
    }
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
    const isDirty = original !== null && JSON.stringify(original) !== JSON.stringify(editingCourseDraft);

    // Only interrupt when there is actually something to lose.
    if (isDirty && !window.confirm(t.course.discardConfirm)) return;

    editingCourseOriginalRef.current = null;
    setEditingCourseId(null);
    setEditingCourseDraft({ ...EMPTY_COURSE_DRAFT });
    setCourseFormError(null);
  }

  function saveEditCourse(semesterId: string) {
    if (!activeProfile || !editingCourseId) return;

    const validationError = validateCourseDraft(editingCourseDraft);
    if (validationError) {
      setCourseFormError(validationError);
      return;
    }

    const parsed = parseCourseDraft(editingCourseDraft);
    if (!parsed) return;
    if (!window.confirm(t.course.saveConfirm(parsed.name))) return;

    const profileId = activeProfile.id;
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

    editingCourseOriginalRef.current = null;
    setEditingCourseId(null);
    setEditingCourseDraft({ ...EMPTY_COURSE_DRAFT });
    setCourseFormError(null);
  }

  function handleBinaryCreditCapChange(rawValue: string) {
    if (!activeProfile) return;

    const trimmed = rawValue.trim();
    const parsed = Number(trimmed);
    const nextCap = trimmed === "" || !Number.isFinite(parsed) || parsed <= 0 ? null : parsed;
    const profileId = activeProfile.id;

    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === profileId ? { ...profile, binaryCreditCap: nextCap } : profile
      )
    }));
  }

  function applySelectedAsBinary() {
    if (!activeProfile || simulator.selectedCourses.length === 0) return;

    const selectedKeys = new Set(simulator.selectedCourses.map((course) => course.key));
    if (!window.confirm(t.simulator.applyConfirm(selectedKeys.size))) return;

    const profileId = activeProfile.id;
    setMutatingState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id !== profileId
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

    simulator.clearSelection();
  }

  if (authLoading) {
    return <StatusScreen message={t.app.checkingAuth} />;
  }

  if (!user) {
    return (
      <AuthScreen
        mode={authMode}
        onModeChange={setAuthMode}
        email={email}
        onEmailChange={setEmail}
        password={password}
        onPasswordChange={setPassword}
        rememberEmail={rememberEmail}
        onRememberEmailChange={(next) => {
          setRememberEmail(next);
          if (!next) localStorage.removeItem(REMEMBERED_EMAIL_KEY);
          else if (email.trim()) localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
        }}
        isDark={resolvedMode === "dark"}
        onToggleTheme={toggleMode}
        onGoogle={handleGoogleSignIn}
        onSignIn={handleEmailSignIn}
        onRegister={handleRegister}
        onReset={handleResetPassword}
        authError={authError}
        notice={importSuccess}
        initError={firebaseInitError}
      />
    );
  }

  if (dataLoading) {
    return <StatusScreen message={t.app.loadingData} />;
  }

  const userLabel = state.account.fullName.trim() || user.displayName || user.email || user.uid;
  const userInitial = userLabel.trim().charAt(0).toUpperCase() || "?";
  const hasPasswordProvider = user.providerData.some((provider) => provider.providerId === "password");

  if (view === "settings" && accountDraft) {
    return (
      <SettingsScreen
        user={user}
        userInitial={userInitial}
        hasPasswordProvider={hasPasswordProvider}
        appearance={appearance}
        onAppearanceChange={patchAppearance}
        accountDraft={accountDraft}
        onAccountDraftChange={(patch) => setAccountDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
        passwordDraft={passwordDraft}
        onPasswordDraftChange={(patch) => setPasswordDraft((prev) => ({ ...prev, ...patch }))}
        busy={accountBusy}
        error={accountError}
        success={accountSuccess}
        lastModified={state.lastModified}
        onBack={() => goTo("dashboard")}
        onSaveAccount={handleSaveAccount}
        onChangeEmail={handleChangeEmail}
        onChangePassword={handleChangePassword}
        onDownloadBackup={handleDownloadBackup}
        onExportExcel={handleExportExcel}
        onUploadBackup={handleUploadBackup}
      />
    );
  }

  const addCourseSemester = activeProfile?.semesters.find((item) => item.id === addCourseSemesterId);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        userLabel={userLabel}
        userInitial={userInitial}
        lastModified={state.lastModified}
        isDark={resolvedMode === "dark"}
        onToggleTheme={toggleMode}
        onOpenSettings={openSettings}
        onSignOut={handleSignOutUser}
        onDownloadBackup={handleDownloadBackup}
        onExportExcel={handleExportExcel}
        onUploadBackup={handleUploadBackup}
      />

      <main className="px-safe mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {(loadError || saveError || importError || importSuccess || firebaseInitError) && (
          <div className="mb-5 flex flex-col gap-2.5">
            {loadError && <Banner tone="warning">{loadError}</Banner>}
            {saveError && <Banner tone="error">{saveError}</Banner>}
            {importError && <Banner tone="error">{importError}</Banner>}
            {importSuccess && <Banner tone="success">{importSuccess}</Banner>}
            {firebaseInitError && (
              <Banner tone="error">
                {t.auth.firebaseInitError} {firebaseInitError}
              </Banner>
            )}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
          <ProfilesPanel
            profiles={state.profiles}
            activeProfileId={state.activeProfileId}
            onSwitch={(id) => setMutatingState((prev) => ({ ...prev, activeProfileId: id }))}
            onCreate={handleCreateProfile}
            onRename={handleRenameProfile}
            onDelete={handleDeleteProfile}
          />

          <DashboardScreen
            activeProfile={activeProfile}
            overallGpa={overallGpa}
            totalCredits={totalCredits}
            annualGpas={annualGpas}
            browser={browser}
            onOpenAddSemester={() => setIsAddSemesterOpen(true)}
            simulator={simulator}
            simulatorOpen={simulatorOpen}
            onSimulatorOpenChange={setSimulatorOpen}
            onBinaryCreditCapChange={handleBinaryCreditCapChange}
            onApplyBinary={applySelectedAsBinary}
            editingSemesterId={editingSemesterId}
            editingSemesterDraft={editingSemesterDraft}
            onEditingSemesterDraftChange={(patch) => setEditingSemesterDraft((prev) => ({ ...prev, ...patch }))}
            onBeginEditSemester={beginEditSemester}
            onSaveEditSemester={saveEditSemester}
            onCancelEditSemester={cancelEditSemester}
            onDeleteSemester={handleDeleteSemester}
            onAddCourse={openAddCourse}
            editingCourseId={editingCourseId}
            editingCourseDraft={editingCourseDraft}
            editingCourseError={courseFormError}
            onEditingCourseDraftChange={(patch) => setEditingCourseDraft((prev) => ({ ...prev, ...patch }))}
            onBeginEditCourse={beginEditCourse}
            onSaveEditCourse={saveEditCourse}
            onCancelEditCourse={cancelEditCourse}
            onDeleteCourse={handleDeleteCourse}
            registerSemesterNode={(semesterId, node) => {
              semesterNodeRefs.current[semesterId] = node;
            }}
          />
        </div>
      </main>

      {activeProfile && (
        <>
          <AddSemesterSheet
            open={isAddSemesterOpen}
            onOpenChange={setIsAddSemesterOpen}
            draft={activeSemesterDraft}
            onDraftChange={handleSemesterDraftChange}
            onAdd={handleAddSemester}
          />

          <AddCourseSheet
            open={addCourseSemesterId !== null}
            onOpenChange={(open) => {
              if (!open) {
                setAddCourseSemesterId(null);
                setAddCourseAddedCount(0);
              }
            }}
            semester={addCourseSemester}
            draft={courseDraftBySemester[addCourseSemesterId ?? ""] ?? EMPTY_COURSE_DRAFT}
            onDraftChange={(patch) => addCourseSemesterId && handleCourseDraftChange(addCourseSemesterId, patch)}
            error={courseFormErrorBySemester[addCourseSemesterId ?? ""] ?? null}
            addedCount={addCourseAddedCount}
            onAdd={() => addCourseSemesterId && handleAddCourse(addCourseSemesterId)}
            nameInputRef={(node) => {
              if (addCourseSemesterId) courseNameInputRefs.current[addCourseSemesterId] = node;
            }}
          />
        </>
      )}

      <VersionFooter />
    </div>
  );
}
