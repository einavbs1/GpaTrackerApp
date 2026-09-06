import { useRef } from "react";
import type { User } from "firebase/auth";
import { ArrowRight, Check, Download, FileSpreadsheet, Mail, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Banner, Card, SectionHeading } from "@/components/ui/surface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/menu";
import { VersionFooter } from "@/components/layout/StatusScreen";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { MIN_PASSWORD_LENGTH, type AccountDraft, type PasswordDraft } from "@/lib/drafts";
import { PRIMARY_SWATCHES, SURFACE_SWATCHES } from "@/lib/theme";
import { firebaseProjectId } from "@/firebase";
import type { Appearance, ThemeMode } from "@/types";

const MODES: ThemeMode[] = ["dark", "light", "system"];

interface SettingsScreenProps {
  user: User;
  userInitial: string;
  hasPasswordProvider: boolean;
  appearance: Appearance;
  onAppearanceChange: (patch: Partial<Appearance>) => void;
  accountDraft: AccountDraft;
  onAccountDraftChange: (patch: Partial<AccountDraft>) => void;
  passwordDraft: PasswordDraft;
  onPasswordDraftChange: (patch: Partial<PasswordDraft>) => void;
  busy: boolean;
  error: string | null;
  success: string | null;
  lastModified: number;
  onBack: () => void;
  onSaveAccount: () => void;
  onChangeEmail: () => void;
  onChangePassword: () => void;
  onDownloadBackup: () => void;
  onExportExcel: () => void;
  onUploadBackup: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SettingsScreen({
  user,
  userInitial,
  hasPasswordProvider,
  appearance,
  onAppearanceChange,
  accountDraft,
  onAccountDraftChange,
  passwordDraft,
  onPasswordDraftChange,
  busy,
  error,
  success,
  lastModified,
  onBack,
  onSaveAccount,
  onChangeEmail,
  onChangePassword,
  onDownloadBackup,
  onExportExcel,
  onUploadBackup
}: SettingsScreenProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="pt-safe pb-safe px-safe flex min-h-dvh flex-col">
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <header className="animate-enter flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label={t.nav.back}>
            {/* Points back toward the dashboard; RTL flips the visual direction. */}
            <ArrowRight className="rtl:rotate-0 ltr:rotate-180" />
          </Button>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-base font-bold text-primary-ink">
            {userInitial}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl text-ink-strong">{t.settings.title}</h1>
            <p className="truncate text-xs text-ink-faint">
              {hasPasswordProvider ? t.settings.account.emailAccount : t.settings.account.googleAccount}
            </p>
          </div>
        </header>

        <div className="mt-6 flex flex-col gap-5">
          {error && <Banner tone="error">{error}</Banner>}
          {success && <Banner tone="success">{success}</Banner>}

          <Tabs defaultValue="account">
            <TabsList className="animate-enter">
              <TabsTrigger value="account">{t.settings.tabs.account}</TabsTrigger>
              <TabsTrigger value="appearance">{t.settings.tabs.appearance}</TabsTrigger>
              <TabsTrigger value="data">{t.settings.tabs.data}</TabsTrigger>
              <TabsTrigger value="about">{t.settings.tabs.about}</TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="mt-5 flex flex-col gap-5">
              <Card className="flex flex-col gap-5 p-6">
                <SectionHeading title={t.settings.account.title} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t.settings.account.displayName}>
                    <Input
                      autoComplete="nickname"
                      value={accountDraft.displayName}
                      placeholder={t.settings.account.displayNamePlaceholder}
                      onChange={(event) => onAccountDraftChange({ displayName: event.target.value })}
                    />
                  </Field>
                  <Field label={t.settings.account.fullName}>
                    <Input
                      autoComplete="name"
                      value={accountDraft.fullName}
                      placeholder={t.settings.account.fullNamePlaceholder}
                      onChange={(event) => onAccountDraftChange({ fullName: event.target.value })}
                    />
                  </Field>
                  <Field label={t.settings.account.institution}>
                    <Input
                      autoComplete="organization"
                      value={accountDraft.institution}
                      placeholder={t.settings.account.institutionPlaceholder}
                      onChange={(event) => onAccountDraftChange({ institution: event.target.value })}
                    />
                  </Field>
                  <Field label={t.settings.account.degreeProgram}>
                    <Input
                      value={accountDraft.degreeProgram}
                      placeholder={t.settings.account.degreePlaceholder}
                      onChange={(event) => onAccountDraftChange({ degreeProgram: event.target.value })}
                    />
                  </Field>
                  <Field label={t.settings.account.studentId} optional>
                    <Input
                      value={accountDraft.studentId}
                      onChange={(event) => onAccountDraftChange({ studentId: event.target.value })}
                    />
                  </Field>
                  <Field label={t.settings.account.graduationYear} optional>
                    <Input
                      type="number"
                      min={1900}
                      max={2200}
                      step={1}
                      inputMode="numeric"
                      value={accountDraft.expectedGraduationYear}
                      onChange={(event) => onAccountDraftChange({ expectedGraduationYear: event.target.value })}
                    />
                  </Field>
                  <Field label={t.settings.account.targetGpa} optional>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      inputMode="decimal"
                      value={accountDraft.targetGpa}
                      onChange={(event) => onAccountDraftChange({ targetGpa: event.target.value })}
                    />
                  </Field>
                  <Field label={t.settings.account.requiredCredits} optional>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      inputMode="decimal"
                      value={accountDraft.requiredCredits}
                      onChange={(event) => onAccountDraftChange({ requiredCredits: event.target.value })}
                    />
                  </Field>
                </div>
                <Button variant="primary" className="self-start" disabled={busy} onClick={onSaveAccount}>
                  <Check /> {t.settings.account.saveDetails}
                </Button>
              </Card>

              {hasPasswordProvider ? (
                <>
                  <Card className="flex flex-col gap-5 p-6">
                    <SectionHeading title={t.settings.account.emailTitle} hint={t.settings.account.emailHint} />
                    <Field label={t.auth.email} className="sm:max-w-sm">
                      <Input
                        type="email"
                        autoComplete="email"
                        value={accountDraft.email}
                        onChange={(event) => onAccountDraftChange({ email: event.target.value })}
                      />
                    </Field>
                    <Button variant="neutral" className="self-start" disabled={busy} onClick={onChangeEmail}>
                      <Mail /> {t.settings.account.sendVerification}
                    </Button>
                  </Card>

                  <Card className="flex flex-col gap-5 p-6">
                    <SectionHeading
                      title={t.settings.account.passwordTitle}
                      hint={t.settings.account.passwordHint(MIN_PASSWORD_LENGTH)}
                    />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label={t.settings.account.currentPassword}>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          value={passwordDraft.current}
                          onChange={(event) => onPasswordDraftChange({ current: event.target.value })}
                        />
                      </Field>
                      <Field label={t.settings.account.newPassword}>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          value={passwordDraft.next}
                          onChange={(event) => onPasswordDraftChange({ next: event.target.value })}
                        />
                      </Field>
                      <Field label={t.settings.account.confirmPassword}>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          value={passwordDraft.confirm}
                          onChange={(event) => onPasswordDraftChange({ confirm: event.target.value })}
                        />
                      </Field>
                    </div>
                    <Button
                      variant="neutral"
                      className="self-start"
                      disabled={busy || !passwordDraft.current || !passwordDraft.next}
                      onClick={onChangePassword}
                    >
                      <Check /> {t.settings.account.updatePassword}
                    </Button>
                  </Card>
                </>
              ) : (
                <Card className="p-6">
                  <SectionHeading
                    title={t.settings.account.signInMethod}
                    hint={t.settings.account.googleHint(user.email ?? "")}
                  />
                </Card>
              )}
            </TabsContent>

            <TabsContent value="appearance" className="mt-5 flex flex-col gap-5">
              <Card className="flex flex-col gap-5 p-6">
                <SectionHeading title={t.settings.appearance.modeTitle} hint={t.settings.appearance.modeHint} />
                <div className="flex flex-wrap gap-2">
                  {MODES.map((mode) => (
                    <Button
                      key={mode}
                      variant={appearance.mode === mode ? "primary" : "neutral"}
                      size="sm"
                      onClick={() => onAppearanceChange({ mode })}
                      aria-pressed={appearance.mode === mode}
                    >
                      {t.settings.appearance.modes[mode]}
                    </Button>
                  ))}
                </div>
              </Card>

              <Card className="flex flex-col gap-5 p-6">
                <SectionHeading title={t.settings.appearance.primaryTitle} hint={t.settings.appearance.primaryHint} />
                <div className="flex flex-wrap gap-3">
                  {PRIMARY_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.id}
                      type="button"
                      onClick={() => onAppearanceChange({ primaryId: swatch.id })}
                      aria-pressed={appearance.primaryId === swatch.id}
                      title={swatch.label}
                      className={cn(
                        "press flex flex-col items-center gap-2 rounded-2xl border p-3",
                        appearance.primaryId === swatch.id
                          ? "border-primary bg-primary-soft"
                          : "border-line hover:border-line-strong"
                      )}
                    >
                      <span
                        className="size-9 rounded-full border border-line"
                        style={{ background: swatch.preview }}
                        aria-hidden="true"
                      />
                      <span className="text-2xs text-ink-muted">{swatch.label}</span>
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="flex flex-col gap-5 p-6">
                <SectionHeading title={t.settings.appearance.surfaceTitle} hint={t.settings.appearance.surfaceHint} />
                <div className="flex flex-wrap gap-3">
                  {SURFACE_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.id}
                      type="button"
                      onClick={() => onAppearanceChange({ surfaceId: swatch.id })}
                      aria-pressed={appearance.surfaceId === swatch.id}
                      title={swatch.label}
                      className={cn(
                        "press flex flex-col items-center gap-2 rounded-2xl border p-3",
                        appearance.surfaceId === swatch.id
                          ? "border-primary bg-primary-soft"
                          : "border-line hover:border-line-strong"
                      )}
                    >
                      <span
                        className="size-9 rounded-xl border border-line"
                        style={{ background: swatch.preview }}
                        aria-hidden="true"
                      />
                      <span className="text-2xs text-ink-muted">{swatch.label}</span>
                    </button>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="data" className="mt-5">
              <Card className="flex flex-col gap-5 p-6">
                <SectionHeading title={t.settings.data.title} hint={t.settings.data.hint} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="neutral" onClick={onDownloadBackup}>
                    <Download /> {t.topbar.downloadBackup}
                  </Button>
                  <Button variant="neutral" onClick={onExportExcel}>
                    <FileSpreadsheet /> {t.topbar.exportExcel}
                  </Button>
                  <Button variant="neutral" onClick={() => fileInputRef.current?.click()}>
                    <Upload /> {t.topbar.uploadBackup}
                  </Button>
                </div>
                <p className="text-2xs text-ink-faint">
                  {t.topbar.lastModified}: {formatDateTime(lastModified)}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={onUploadBackup}
                />
              </Card>
            </TabsContent>

            <TabsContent value="about" className="mt-5">
              <Card className="flex flex-col gap-3 p-6 text-sm">
                <SectionHeading title={t.settings.about.title} />
                <dl className="tnum grid gap-2 sm:grid-cols-2">
                  <div className="flex justify-between gap-4 rounded-2xl bg-raised/50 px-4 py-3">
                    <dt className="text-ink-muted">{t.settings.about.version}</dt>
                    <dd className="text-ink-strong">v{__APP_VERSION__}</dd>
                  </div>
                  <div className="flex justify-between gap-4 rounded-2xl bg-raised/50 px-4 py-3">
                    <dt className="text-ink-muted">{t.settings.about.commit}</dt>
                    <dd className="text-ink-strong">{__GIT_COMMIT__}</dd>
                  </div>
                  <div className="flex justify-between gap-4 rounded-2xl bg-raised/50 px-4 py-3">
                    <dt className="text-ink-muted">{t.settings.about.built}</dt>
                    <dd className="text-ink-strong">{__BUILD_DATE__}</dd>
                  </div>
                  <div className="flex justify-between gap-4 rounded-2xl bg-raised/50 px-4 py-3">
                    <dt className="text-ink-muted">{t.settings.about.project}</dt>
                    <dd className="text-ink-strong">{firebaseProjectId ?? "—"}</dd>
                  </div>
                </dl>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <VersionFooter />
    </div>
  );
}
