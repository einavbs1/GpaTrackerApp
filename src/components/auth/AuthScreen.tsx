import { GraduationCap, LogIn, Mail, Moon, Sun, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { CheckboxField } from "@/components/ui/toggle";
import { Banner } from "@/components/ui/surface";
import { VersionFooter } from "@/components/layout/StatusScreen";
import { t } from "@/lib/i18n";

export type AuthMode = "signin" | "register" | "reset";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5">
      <path
        fill="#EA4335"
        d="M24 9.5c3.15 0 5.64 1.08 7.54 2.84l5.62-5.62C33.72 3.58 29.22 1.5 24 1.5 14.82 1.5 7.06 7.1 3.72 14.96l6.55 5.09C12.02 14.02 17.56 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.64-.15-3.22-.42-4.75H24v9.01h12.64c-.55 2.93-2.2 5.41-4.68 7.08l7.18 5.58C43.44 37.3 46.5 31.38 46.5 24.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.27 28.05A14.53 14.53 0 0 1 9.5 24c0-1.41.24-2.77.65-4.05L3.6 14.86A22.93 22.93 0 0 0 1.5 24c0 3.27.68 6.38 1.9 9.2l6.87-5.15z"
      />
      <path
        fill="#34A853"
        d="M24 46.5c5.22 0 9.6-1.72 12.8-4.68l-7.18-5.58c-1.73 1.16-3.95 1.84-5.62 1.84-6.44 0-11.98-4.52-13.73-10.55l-6.55 5.09C7.06 40.9 14.82 46.5 24 46.5z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 py-1">
      <span className="h-px flex-1 bg-line" />
      <span className="text-2xs text-ink-faint">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

interface AuthScreenProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  rememberEmail: boolean;
  onRememberEmailChange: (value: boolean) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onGoogle: () => void;
  onSignIn: () => void;
  onRegister: () => void;
  onReset: () => void;
  authError: string | null;
  notice: string | null;
  initError: string | null;
}

export function AuthScreen({
  mode,
  onModeChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  rememberEmail,
  onRememberEmailChange,
  isDark,
  onToggleTheme,
  onGoogle,
  onSignIn,
  onRegister,
  onReset,
  authError,
  notice,
  initError
}: AuthScreenProps) {
  const submit = mode === "signin" ? onSignIn : mode === "register" ? onRegister : onReset;

  return (
    <div className="pt-safe pb-safe px-safe flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-5 py-8 lg:grid lg:grid-cols-[1.05fr_minmax(24rem,26rem)] lg:items-center lg:gap-20 lg:px-10">
        <section className="animate-enter">
          <div className="flex items-center justify-between gap-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <GraduationCap className="size-6" />
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              aria-label={isDark ? t.topbar.toLight : t.topbar.toDark}
              title={isDark ? t.topbar.toLight : t.topbar.toDark}
            >
              {isDark ? <Sun /> : <Moon />}
            </Button>
          </div>

          <h1 className="mt-10 max-w-[14ch] text-3xl text-ink-strong sm:text-4xl">{t.app.name}</h1>
          <p className="mt-6 max-w-prose text-base leading-relaxed text-ink-muted">{t.app.tagline}</p>
        </section>

        <section
          className="animate-enter rounded-3xl border border-line bg-surface p-6 shadow-lifted sm:p-8"
          style={{ animationDelay: "80ms" }}
        >
          <div className="flex flex-col gap-5">
            {initError && (
              <Banner tone="error">
                {t.auth.firebaseInitError} {initError}
              </Banner>
            )}

            {mode !== "signin" && (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => onModeChange("signin")}>
                {t.auth.backToSignIn}
              </Button>
            )}

            {mode !== "reset" && (
              <>
                <Button variant="neutral" size="lg" className="w-full" onClick={onGoogle}>
                  <GoogleMark />
                  {mode === "register" ? t.auth.signUpWithGoogle : t.auth.continueWithGoogle}
                </Button>
                <Divider label={mode === "register" ? t.auth.orRegisterWithEmail : t.auth.orWithEmail} />
              </>
            )}

            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <Field label={t.auth.email}>
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                  placeholder={t.auth.emailPlaceholder}
                />
              </Field>

              {mode !== "reset" && (
                <Field label={t.auth.password}>
                  <Input
                    type="password"
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    required
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    placeholder={mode === "register" ? t.auth.newPasswordPlaceholder : t.auth.passwordPlaceholder}
                  />
                </Field>
              )}

              {mode === "signin" && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CheckboxField
                    checked={rememberEmail}
                    onCheckedChange={(checked) => onRememberEmailChange(checked === true)}
                  >
                    {t.auth.rememberEmail}
                  </CheckboxField>
                  <Button variant="link" size="sm" onClick={() => onModeChange("reset")}>
                    {t.auth.forgotPassword}
                  </Button>
                </div>
              )}

              {mode === "register" && (
                <CheckboxField
                  checked={rememberEmail}
                  onCheckedChange={(checked) => onRememberEmailChange(checked === true)}
                >
                  {t.auth.rememberEmailOnDevice}
                </CheckboxField>
              )}

              {mode === "reset" && <p className="text-sm leading-relaxed text-ink-muted">{t.auth.resetIntro}</p>}

              <Button type="submit" variant="primary" size="lg" className="mt-1 w-full">
                {mode === "signin" && (
                  <>
                    <LogIn /> {t.auth.signIn}
                  </>
                )}
                {mode === "register" && (
                  <>
                    <UserPlus /> {t.auth.createAccount}
                  </>
                )}
                {mode === "reset" && (
                  <>
                    <Mail /> {t.auth.sendResetLink}
                  </>
                )}
              </Button>
            </form>

            {mode === "signin" && (
              <p className="text-center text-sm text-ink-muted">
                {t.auth.noAccount}{" "}
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onModeChange("register")}>
                  {t.auth.createOne}
                </Button>
              </p>
            )}

            {notice && <Banner tone="success">{notice}</Banner>}
            {authError && <Banner tone="error">{authError}</Banner>}
          </div>
        </section>
      </div>

      <VersionFooter />
    </div>
  );
}
