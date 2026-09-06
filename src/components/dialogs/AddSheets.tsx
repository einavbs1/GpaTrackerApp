import { Check, Plus } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { CheckboxField } from "@/components/ui/toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { seasonLabel, t } from "@/lib/i18n";
import { validateCourseDraft, type CourseDraft, type SemesterDraft } from "@/lib/drafts";
import { SEASONS, type Semester, type SemesterSeason } from "@/types";

interface AddCourseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semester: Semester | undefined;
  draft: CourseDraft;
  onDraftChange: (patch: Partial<CourseDraft>) => void;
  error: string | null;
  addedCount: number;
  onAdd: () => void;
  nameInputRef: (node: HTMLInputElement | null) => void;
}

export function AddCourseSheet({
  open,
  onOpenChange,
  semester,
  draft,
  onDraftChange,
  error,
  addedCount,
  onAdd,
  nameInputRef
}: AddCourseSheetProps) {
  const invalidReason = validateCourseDraft(draft);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.course.addTitle}
      description={
        semester
          ? `${t.semesters.yearLabel(semester.academicYear)} · ${t.semesters.semesterTitle(
              semester.semesterNumber,
              seasonLabel(semester.season)
            )}`
          : undefined
      }
      footer={
        <>
          {addedCount > 0 && (
            <span className="me-auto text-2xs text-ink-faint">{t.course.addedCount(addedCount)}</span>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <Check /> {t.course.done}
          </Button>
          <Button variant="primary" disabled={invalidReason !== null} title={invalidReason ?? undefined} onClick={onAdd}>
            <Plus /> {t.course.add}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (invalidReason === null) onAdd();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.course.code} optional>
            <Input
              value={draft.code}
              placeholder={t.course.codePlaceholder}
              onChange={(event) => onDraftChange({ code: event.target.value })}
            />
          </Field>
          <Field label={t.course.name} required>
            <Input
              autoFocus
              ref={nameInputRef}
              value={draft.name}
              onChange={(event) => onDraftChange({ name: event.target.value })}
            />
          </Field>
          <Field label={t.course.credits} required>
            <Input
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              value={draft.credits}
              onChange={(event) => onDraftChange({ credits: event.target.value })}
            />
          </Field>
          <Field label={t.course.gradeRange} required={!draft.isBinaryPass}>
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              disabled={draft.isBinaryPass}
              value={draft.grade}
              onChange={(event) => onDraftChange({ grade: event.target.value })}
            />
          </Field>
        </div>

        <CheckboxField
          checked={draft.isBinaryPass}
          onCheckedChange={(checked) =>
            onDraftChange({ isBinaryPass: checked === true, ...(checked === true ? { grade: "" } : {}) })
          }
        >
          {t.course.binaryPass}
        </CheckboxField>

        {error && <p className="text-sm text-critical">{error}</p>}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </ResponsiveDialog>
  );
}

interface AddSemesterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: SemesterDraft;
  onDraftChange: (patch: Partial<SemesterDraft>) => void;
  onAdd: () => void;
}

export function AddSemesterSheet({ open, onOpenChange, draft, onDraftChange, onAdd }: AddSemesterSheetProps) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.semesters.addTitle}
      className="md:w-[min(32rem,calc(100vw-2.5rem))]"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.semesters.cancel}
          </Button>
          <Button variant="primary" onClick={onAdd}>
            <Plus /> {t.semesters.add}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 pb-2 sm:grid-cols-3">
        <Field label={t.semesters.year}>
          <Input
            type="number"
            min={1}
            step={1}
            autoFocus
            inputMode="numeric"
            value={draft.academicYear}
            onChange={(event) => onDraftChange({ academicYear: event.target.value })}
          />
        </Field>
        <Field label={t.semesters.semesterNumber}>
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={draft.semesterNumber}
            onChange={(event) => onDraftChange({ semesterNumber: event.target.value })}
          />
        </Field>
        <Field label={t.semesters.season}>
          <Select value={draft.season} onValueChange={(value) => onDraftChange({ season: value as SemesterSeason })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEASONS.map((season) => (
                <SelectItem key={season} value={season}>
                  {seasonLabel(season)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </ResponsiveDialog>
  );
}
