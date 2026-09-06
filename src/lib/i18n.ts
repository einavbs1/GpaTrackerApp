/**
 * Single source of truth for all UI copy. The app ships Hebrew-only; keeping the
 * strings here means a second locale is a new object rather than a component sweep.
 */
export const t = {
  app: {
    name: "מחשבון ממוצע תואר",
    tagline: "מעקב אחרי ההתקדמות האקדמית שלך — סמסטרים, פרופילים ושנים, מסונכרן לענן.",
    checkingAuth: "מאמת את החשבון…",
    loadingData: "טוען את הנתונים שלך…"
  },
  nav: {
    dashboard: "לוח בקרה",
    settings: "הגדרות",
    back: "חזרה",
    openMenu: "פתיחת תפריט",
    profiles: "פרופילים"
  },
  auth: {
    continueWithGoogle: "המשך עם Google",
    signUpWithGoogle: "הרשמה עם Google",
    orWithEmail: "או התחברות עם אימייל",
    orRegisterWithEmail: "או יצירת חשבון עם אימייל",
    email: "אימייל",
    emailPlaceholder: "you@example.com",
    password: "סיסמה",
    passwordPlaceholder: "הסיסמה שלך",
    newPasswordPlaceholder: "בחר סיסמה",
    rememberEmail: "זכור את האימייל",
    rememberEmailOnDevice: "זכור את האימייל במכשיר הזה",
    forgotPassword: "שכחת סיסמה?",
    signIn: "התחברות",
    noAccount: "אין לך חשבון?",
    createOne: "צור חשבון",
    createAccount: "יצירת חשבון",
    backToSignIn: "חזרה להתחברות",
    sendResetLink: "שליחת קישור לאיפוס",
    resetIntro: "נשלח אליך קישור לאיפוס הסיסמה.",
    firebaseInitError: "שגיאת אתחול Firebase:"
  },
  topbar: {
    accountSettings: "הגדרות חשבון",
    toLight: "מעבר למצב בהיר",
    toDark: "מעבר למצב כהה",
    dataAndBackups: "נתונים וגיבויים",
    signOut: "התנתקות",
    downloadBackup: "הורדת גיבוי (JSON)",
    exportExcel: "ייצוא לאקסל",
    uploadBackup: "העלאת גיבוי (JSON)",
    lastModified: "עודכן לאחרונה"
  },
  profiles: {
    title: "פרופילים",
    newPlaceholder: "שם פרופיל חדש",
    add: "הוספה",
    rename: "שינוי שם פרופיל",
    delete: "מחיקת פרופיל",
    saveName: "שמירת השם",
    cancel: "ביטול",
    emptyState: "צור ובחר פרופיל כדי להתחיל.",
    switchTo: "מעבר לפרופיל"
  },
  stats: {
    overallGpa: "ממוצע כללי",
    totalCredits: 'סה"כ נק"ז שנצברו',
    annualGpa: "ממוצע שנתי",
    academicYear: "שנה אקדמית",
    noAnnualGpa: "אין עדיין ממוצע שנתי להצגה."
  },
  search: {
    placeholder: "חיפוש קורסים בכל הסמסטרים…",
    label: "חיפוש קורסים בכל הסמסטרים",
    clear: "ניקוי",
    noMatch: (query: string) => `אין קורס שתואם ל־"${query}".`,
    summary: (courses: number, semesters: number) => `${courses} קורסים ב־${semesters} סמסטרים.`,
    noMatchLong: (query: string) => `אין שם קורס או קוד שמכיל "${query}".`
  },
  semesters: {
    add: "הוספת סמסטר",
    addTitle: "הוספת סמסטר",
    collapseAll: "כיווץ הכול",
    expandAll: "פתיחת הכול",
    year: "שנה",
    yearLabel: (year: number) => `שנה אקדמית ${year}`,
    semesterNumber: "מספר סמסטר",
    season: "עונה",
    semesterTitle: (num: number, season: string) => `סמסטר ${num} · ${season}`,
    counts: (count: number) => `${count} קורסים`,
    credits: (credits: string) => `${credits} נק"ז`,
    matches: (count: number) => `${count} תוצאות`,
    gpa: "ממוצע",
    edit: "עריכת סמסטר",
    save: "שמירת סמסטר",
    remove: "מחיקת סמסטר",
    cancel: "ביטול",
    empty: "אין עדיין סמסטרים. הוסף את הראשון למעלה.",
    addCourse: "הוספת קורס",
    noCourses: "אין עדיין קורסים בסמסטר הזה.",
    deleteConfirm: (year: number, num: number, season: string, courses: number) =>
      `למחוק את שנה ${year} · סמסטר ${num} · ${season}?\n\n${courses} קורסים יימחקו לצמיתות. לא ניתן לבטל.`
  },
  seasons: {
    "Winter A": "חורף א׳",
    "Spring B": "אביב ב׳",
    Summer: "קיץ"
  } as Record<string, string>,
  course: {
    number: "#",
    code: "קוד",
    codeOptional: "(רשות)",
    name: "קורס",
    credits: 'נק"ז',
    grade: "ציון",
    gradeRange: "ציון (0–100)",
    binary: "בינארי",
    actions: "פעולות",
    yes: "כן",
    no: "לא",
    notGraded: 'ללא ציון',
    required: "*",
    binaryPass: "מעבר בינארי (עובר/נכשל)",
    add: "הוספת קורס",
    addTitle: "הוספת קורס",
    edit: "עריכת קורס",
    save: "שמירת השינויים",
    cancel: "ביטול",
    delete: "מחיקת קורס",
    done: "סיום",
    codePlaceholder: "לדוגמה 104013",
    addedCount: (count: number) => (count === 1 ? "קורס אחד נוסף" : `${count} קורסים נוספו`),
    deleteConfirm: (name: string) => `למחוק את הקורס "${name}"? לא ניתן לבטל.`,
    saveConfirm: (name: string) => `לשמור את השינויים ב"${name}"?`,
    discardConfirm: "לבטל את השינויים שלא נשמרו בקורס הזה?",
    errors: {
      nameRequired: "חובה להזין שם קורס.",
      creditsRequired: 'נק"ז חייבים להיות מספר גדול מ־0.',
      gradeRequired: "חובה להזין ציון, אלא אם הקורס בינארי.",
      gradeRange: "הציון חייב להיות בין 0 ל־100."
    }
  },
  simulator: {
    title: "סימולטור מעבר בינארי",
    open: "פתיחת הסימולטור",
    description:
      "בדוק מה יקרה לממוצע הכללי אם קורס יעבור למתכונת עובר/נכשל. נפתח בחלון שאפשר לגרור הצידה בזמן העבודה.",
    hide: "מזעור לצד",
    close: "סגירה",
    currentGpa: "ממוצע נוכחי",
    simulatedGpa: "ממוצע מדומה",
    nothingSelected: "עדיין לא נבחר כלום",
    selectedCount: (count: number) => `${count} קורסים כבינאריים`,
    binaryCredits: 'נק"ז בינאריים',
    creditsBreakdown: (existing: string, selected: string) => `${existing} כבר בינאריים + ${selected} שנבחרו`,
    creditCap: 'תקרת נק"ז',
    noLimit: "ללא הגבלה",
    capHint: "השאר ריק אם אין מגבלה בתואר שלך",
    overCap: (used: string, over: string, cap: string) =>
      `הבחירה משתמשת ב־${used} נק"ז בינאריים, שזה ${over} מעל התקרה שלך של ${cap}.`,
    noGradedLeft: "לא יישארו נקודות זכות מדורגות, ולכן אי אפשר לחשב ממוצע לבחירה הזו.",
    filterSemesters: (shown: number, total: number) => `סינון סמסטרים (${shown} מתוך ${total} מוצגים)`,
    selectAll: "בחירת הכול",
    clearAll: "ניקוי הכול",
    noMatching: "אין קורסים תואמים בסמסטרים שנבחרו.",
    noGpa: "אין עדיין ממוצע כללי.",
    allAbove: (gpa: string) => `אין קורסים לא־בינאריים מתחת לממוצע הכללי הנוכחי (${gpa}).`,
    sortBy: "מיון לפי",
    sortOptions: {
      impact: "השפעה גדולה",
      grade: "ציון נמוך",
      credits: 'הכי הרבה נק"ז',
      chronological: "כרונולוגי"
    },
    when: "מתי",
    impact: "השפעה",
    ifOnlyThis: "רק הקורס הזה",
    simulateAria: (name: string) => `הדמיית ${name} כמעבר בינארי`,
    showTop: "הצגת 5 המובילים",
    showAll: (count: number) => `הצגת הכול (${count})`,
    clearSelection: "ניקוי הבחירה",
    apply: (count: number) => (count > 0 ? `סימון ${count} כבינאריים` : "סימון כבינאריים"),
    applyConfirm: (count: number) =>
      `לסמן ${count} קורסים כמעבר בינארי? הציונים יישמרו אך יפסיקו להיספר בממוצע.`
  },
  settings: {
    title: "הגדרות",
    tabs: {
      account: "חשבון",
      appearance: "מראה",
      data: "נתונים",
      about: "אודות"
    },
    appearance: {
      title: "מראה",
      modeTitle: "ערכת נושא",
      modeHint: "מצב אוטומטי עוקב אחרי הגדרת המערכת שלך.",
      modes: { dark: "כהה", light: "בהיר", system: "אוטומטי" },
      primaryTitle: "צבע ראשי",
      primaryHint: "משמש לכפתורים, הדגשות ומצבי פוקוס.",
      surfaceTitle: "צבע רקע",
      surfaceHint: "גוון הרקע והמשטחים של האפליקציה.",
      preview: "תצוגה מקדימה"
    },
    account: {
      title: "פרטים אישיים",
      emailAccount: "חשבון אימייל וסיסמה",
      googleAccount: "מחובר עם Google",
      displayName: "שם תצוגה",
      displayNamePlaceholder: "מוצג בכל האפליקציה",
      fullName: "שם מלא",
      fullNamePlaceholder: "כפי שמופיע בגיליון הציונים",
      institution: "מוסד לימודים",
      institutionPlaceholder: "אוניברסיטה או מכללה",
      degreeProgram: "תואר / מסלול",
      degreePlaceholder: 'לדוגמה: ב"א מדעי המחשב',
      studentId: "מספר סטודנט",
      graduationYear: "שנת סיום צפויה",
      targetGpa: "ממוצע יעד",
      requiredCredits: 'נק"ז נדרשים לתואר',
      optional: "רשות",
      saveDetails: "שמירת הפרטים",
      saved: "הפרטים נשמרו.",
      emailTitle: "כתובת אימייל",
      emailHint:
        "שינוי הכתובת ישלח קישור אימות לכתובת החדשה. השינוי ייכנס לתוקף רק לאחר האישור, ונדרשת הסיסמה הנוכחית.",
      sendVerification: "שליחת אימות",
      passwordTitle: "סיסמה",
      currentPassword: "סיסמה נוכחית",
      newPassword: "סיסמה חדשה",
      confirmPassword: "אישור סיסמה חדשה",
      passwordHint: (min: number) => `לפחות ${min} תווים.`,
      updatePassword: "עדכון סיסמה",
      passwordUpdated: "הסיסמה עודכנה.",
      signInMethod: "אמצעי התחברות",
      googleHint: (email: string) =>
        `החשבון הזה מתחבר באמצעות Google (${email}). האימייל והסיסמה מנוהלים בחשבון Google שלך.`,
      verificationSent: (email: string) => `נשלח קישור אימות ל־${email}. הכתובת תשתנה לאחר האישור.`
    },
    data: {
      title: "נתונים וגיבויים",
      hint: "הנתונים נשמרים אוטומטית ל־Firestore. אפשר גם לייצא ולייבא גיבוי מקומי."
    },
    about: {
      title: "אודות",
      version: "גרסה",
      commit: "מזהה גרסה",
      built: "נבנה בתאריך",
      project: "פרויקט Firebase"
    }
  },
  errors: {
    loadFailed: "טעינת המסמך מ־Firestore נכשלה. אותחל פרופיל ברירת מחדל.",
    saveFailed: "השמירה האוטומטית ל־Firestore נכשלה.",
    importInvalidFile: "יש לבחור קובץ גיבוי בפורמט ‎.json‎.",
    importInvalidSchema: "מבנה הגיבוי אינו תקין. הייבוא נדחה.",
    importParse: "לא ניתן היה לקרוא את קובץ הגיבוי.",
    importSuccess: "הגיבוי יובא בהצלחה.",
    signOutFailed: "ההתנתקות נכשלה.",
    resetSent: "נשלח מייל לאיפוס סיסמה. בדוק את תיבת הדואר.",
    googleLinked: "התחברות Google קושרה לחשבון האימייל הקיים שלך.",
    generic: "משהו השתבש. נסה שוב."
  }
} as const;

export function seasonLabel(season: string): string {
  return t.seasons[season] ?? season;
}
