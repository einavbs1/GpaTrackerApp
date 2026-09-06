import { t } from "@/lib/i18n";
import { MIN_PASSWORD_LENGTH } from "@/lib/drafts";

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

function fallbackMessage(error: unknown): string {
  return error instanceof Error ? error.message : t.errors.generic;
}

const ACCOUNT_MESSAGES: Record<string, string> = {
  "auth/wrong-password": "הסיסמה הנוכחית שגויה.",
  "auth/invalid-credential": "הסיסמה הנוכחית שגויה.",
  "auth/weak-password": `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים.`,
  "auth/requires-recent-login": "מטעמי אבטחה, התנתק והתחבר מחדש לפני ביצוע השינוי.",
  "auth/email-already-in-use": "כתובת האימייל הזו כבר בשימוש בחשבון אחר.",
  "auth/invalid-email": "כתובת האימייל אינה תקינה.",
  "auth/too-many-requests": "יותר מדי ניסיונות. נסה שוב מאוחר יותר."
};

const GOOGLE_MESSAGES: Record<string, string> = {
  "auth/popup-closed-by-user": "חלון ההתחברות נסגר. נסה שוב.",
  "auth/cancelled-popup-request": "ההתחברות בוטלה. נסה שוב.",
  "auth/popup-blocked": "הדפדפן חסם את החלון הקופץ. אפשר חלונות קופצים ונסה שוב.",
  "auth/too-many-requests": "יותר מדי ניסיונות. המתן רגע ונסה שוב."
};

const SIGN_IN_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "אימייל או סיסמה שגויים. נסה שוב.",
  "auth/user-not-found": "לא נמצא חשבון עם כתובת האימייל הזו.",
  "auth/wrong-password": "סיסמה שגויה. נסה שוב.",
  "auth/too-many-requests": "יותר מדי ניסיונות כושלים. המתן רגע ונסה שוב.",
  "auth/user-disabled": "החשבון הזה הושבת. פנה לתמיכה.",
  "auth/invalid-email": "יש להזין כתובת אימייל תקינה."
};

const REGISTER_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "כבר קיים חשבון עם האימייל הזה. נסה להתחבר במקום.",
  "auth/invalid-email": "יש להזין כתובת אימייל תקינה.",
  "auth/weak-password": "הסיסמה חייבת להכיל לפחות 6 תווים.",
  "auth/too-many-requests": "יותר מדי ניסיונות. המתן רגע ונסה שוב."
};

const RESET_MESSAGES: Record<string, string> = {
  "auth/user-not-found": "לא נמצא חשבון עם כתובת האימייל הזו.",
  "auth/invalid-email": "יש להזין כתובת אימייל תקינה.",
  "auth/too-many-requests": "יותר מדי ניסיונות. המתן רגע ונסה שוב."
};

export function describeAccountError(error: unknown): string {
  return ACCOUNT_MESSAGES[errorCode(error)] ?? fallbackMessage(error);
}

export function describeGoogleError(error: unknown): string {
  return GOOGLE_MESSAGES[errorCode(error)] ?? fallbackMessage(error);
}

export function describeSignInError(error: unknown): string {
  return SIGN_IN_MESSAGES[errorCode(error)] ?? fallbackMessage(error);
}

export function describeRegisterError(error: unknown): string {
  return REGISTER_MESSAGES[errorCode(error)] ?? fallbackMessage(error);
}

export function describeResetError(error: unknown): string {
  return RESET_MESSAGES[errorCode(error)] ?? fallbackMessage(error);
}

export { errorCode };
