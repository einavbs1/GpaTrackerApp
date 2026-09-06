import { Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { CheckboxField } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/surface";
import { HighlightedText } from "@/components/HighlightedText";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { validateCourseDraft, type CourseDraft } from "@/lib/drafts";
import type { Course } from "@/types";

interface CourseEditorProps {
  draft: CourseDraft;
  onChange: (patch: Partial<CourseDraft>) => void;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

function CourseEditor({ draft, onChange, error, onSave, onCancel, onDelete }: CourseEditorProps) {
  const invalidReason = validateCourseDraft(draft);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-primary-soft/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t.course.code} optional>
          <Input value={draft.code} onChange={(event) => onChange({ code: event.target.value })} />
        </Field>
        <Field label={t.course.name} required>
          <Input autoFocus value={draft.name} onChange={(event) => onChange({ name: event.target.value })} />
        </Field>
        <Field label={t.course.credits} required>
          <Input
            type="number"
            min={0}
            step={0.5}
            inputMode="decimal"
            value={draft.credits}
            onChange={(event) => onChange({ credits: event.target.value })}
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
            onChange={(event) => onChange({ grade: event.target.value })}
          />
        </Field>
      </div>

      <CheckboxField
        checked={draft.isBinaryPass}
        onCheckedChange={(checked) =>
          onChange({ isBinaryPass: checked === true, ...(checked === true ? { grade: "" } : {}) })
        }
      >
        {t.course.binaryPass}
      </CheckboxField>

      {(error || invalidReason) && <p className="text-sm text-critical">{error ?? invalidReason}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" disabled={invalidReason !== null} onClick={onSave}>
          <Check /> {t.course.save}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X /> {t.course.cancel}
        </Button>
        <Button variant="danger" size="sm" className="ms-auto" onClick={onDelete}>
          <Trash2 /> {t.course.delete}
        </Button>
      </div>
    </div>
  );
}

interface CourseListProps {
  courses: Course[];
  searchQuery: string;
  matches: Set<string> | undefined;
  editingCourseId: string | null;
  editingDraft: CourseDraft;
  editingError: string | null;
  onEditingDraftChange: (patch: Partial<CourseDraft>) => void;
  onBeginEdit: (course: Course) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (courseId: string) => void;
}

export function CourseList({
  courses,
  searchQuery,
  matches,
  editingCourseId,
  editingDraft,
  editingError,
  onEditingDraftChange,
  onBeginEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete
}: CourseListProps) {
  if (courses.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-ink-faint">{t.semesters.noCourses}</p>;
  }

  const editor = (courseId: string) => (
    <CourseEditor
      draft={editingDraft}
      onChange={onEditingDraftChange}
      error={editingError}
      onSave={onSaveEdit}
      onCancel={onCancelEdit}
      onDelete={() => onDelete(courseId)}
    />
  );

  return (
    <>
      {/* Stacked cards below md: a 7-column table cannot survive a 360px viewport. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {courses.map((course, index) => {
          const isHit = matches?.has(course.id) ?? false;

          if (editingCourseId === course.id) {
            return <li key={course.id}>{editor(course.id)}</li>;
          }

          return (
            <li
              key={course.id}
              className={cn(
                "stagger flex items-start gap-3 rounded-2xl border p-3.5",
                isHit ? "border-caution/40 bg-caution-soft/40" : "border-line bg-raised/40"
              )}
              style={{ "--index": index } as React.CSSProperties}
            >
              <span className="tnum mt-0.5 w-5 shrink-0 text-2xs text-ink-faint">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-strong">
                  <HighlightedText text={course.name} query={searchQuery} />
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {course.code && (
                    <Badge variant="outline" className="font-mono">
                      <HighlightedText text={course.code} query={searchQuery} />
                    </Badge>
                  )}
                  <Badge>{t.semesters.credits(formatNumber(course.credits))}</Badge>
                  <Badge variant={course.isBinaryPass ? "primary" : "muted"}>
                    {course.isBinaryPass ? t.course.binary : `${t.course.grade} ${course.grade ?? t.course.notGraded}`}
                  </Badge>
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => onBeginEdit(course)} aria-label={`${t.course.edit}: ${course.name}`}>
                <Pencil />
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-hidden rounded-2xl border border-line md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-raised/50 text-2xs font-semibold tracking-wide text-ink-faint">
              <th className="w-10 px-3 py-2.5 text-start font-semibold">{t.course.number}</th>
              <th className="px-3 py-2.5 text-start font-semibold">{t.course.code}</th>
              <th className="px-3 py-2.5 text-start font-semibold">{t.course.name}</th>
              <th className="w-24 px-3 py-2.5 text-start font-semibold">{t.course.credits}</th>
              <th className="w-24 px-3 py-2.5 text-start font-semibold">{t.course.grade}</th>
              <th className="w-24 px-3 py-2.5 text-start font-semibold">{t.course.binary}</th>
              <th className="w-16 px-3 py-2.5 text-start font-semibold">{t.course.actions}</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course, index) => {
              const isHit = matches?.has(course.id) ?? false;

              if (editingCourseId === course.id) {
                return (
                  <tr key={course.id}>
                    <td colSpan={7} className="p-2">
                      {editor(course.id)}
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={course.id}
                  className={cn(
                    "border-b border-line/60 transition-colors duration-200 last:border-0 hover:bg-raised/40",
                    isHit && "bg-caution-soft/40"
                  )}
                >
                  <td className="tnum px-3 py-2.5 text-ink-faint">{index + 1}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-ink-muted">
                    {course.code ? <HighlightedText text={course.code} query={searchQuery} /> : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-ink-strong">
                    <HighlightedText text={course.name} query={searchQuery} />
                  </td>
                  <td className="tnum px-3 py-2.5">{formatNumber(course.credits)}</td>
                  <td className="tnum px-3 py-2.5">{course.grade === null ? t.course.notGraded : course.grade}</td>
                  <td className="px-3 py-2.5">{course.isBinaryPass ? t.course.yes : t.course.no}</td>
                  <td className="px-3 py-2.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onBeginEdit(course)}
                      aria-label={`${t.course.edit}: ${course.name}`}
                    >
                      <Pencil />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
