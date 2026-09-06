import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge, GpaPill } from "@/components/ui/surface";
import { Chevron, Collapse } from "@/components/ui/collapse";
import { CourseList } from "@/components/semesters/CourseList";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { seasonLabel, t } from "@/lib/i18n";
import { summarizeCourses, type CourseDraft, type SemesterDraft } from "@/lib/drafts";
import { calculateSemesterGpa, formatGpa } from "@/calculations";
import { SEASONS, type Course, type Semester, type SemesterSeason } from "@/types";

/** Static map: Tailwind cannot see a class name built at runtime. */
export const TONE_BG: Record<number, string> = {
  1: "bg-tone-1",
  2: "bg-tone-2",
  3: "bg-tone-3",
  4: "bg-tone-4",
  5: "bg-tone-5",
  6: "bg-tone-6"
};

interface SemesterCardProps {
  semester: Semester;
  tone: number;
  expanded: boolean;
  toggleDisabled: boolean;
  onToggle: () => void;
  matches: Set<string> | undefined;
  searchQuery: string;
  isEditing: boolean;
  editDraft: SemesterDraft;
  onEditDraftChange: (patch: Partial<SemesterDraft>) => void;
  onBeginEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onAddCourse: () => void;
  editingCourseId: string | null;
  editingCourseDraft: CourseDraft;
  editingCourseError: string | null;
  onEditingCourseDraftChange: (patch: Partial<CourseDraft>) => void;
  onBeginEditCourse: (course: Course) => void;
  onSaveEditCourse: () => void;
  onCancelEditCourse: () => void;
  onDeleteCourse: (courseId: string) => void;
  cardRef: (node: HTMLElement | null) => void;
}

export function SemesterCard({
  semester,
  tone,
  expanded,
  toggleDisabled,
  onToggle,
  matches,
  searchQuery,
  isEditing,
  editDraft,
  onEditDraftChange,
  onBeginEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onAddCourse,
  editingCourseId,
  editingCourseDraft,
  editingCourseError,
  onEditingCourseDraftChange,
  onBeginEditCourse,
  onSaveEditCourse,
  onCancelEditCourse,
  onDeleteCourse,
  cardRef
}: SemesterCardProps) {
  const summary = summarizeCourses(semester.courses);
  const gpa = calculateSemesterGpa(semester.courses);
  const bodyId = `semester_body_${semester.id}`;

  return (
    <article ref={cardRef} className={cn("overflow-hidden rounded-3xl border border-line", TONE_BG[tone])}>
      <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onToggle}
          disabled={toggleDisabled}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className={cn(
            "press flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-2xl px-3 py-2.5 text-start",
            "hover:bg-surface/60 disabled:pointer-events-none"
          )}
        >
          <Chevron open={expanded} />
          <span className="truncate text-sm font-semibold text-ink-strong">
            {t.semesters.semesterTitle(semester.semesterNumber, seasonLabel(semester.season))}
          </span>
          <Badge>{t.semesters.counts(summary.count)}</Badge>
          <Badge>{t.semesters.credits(formatNumber(summary.credits))}</Badge>
          {matches && <Badge variant="hit">{t.semesters.matches(matches.size)}</Badge>}
          <GpaPill className="ms-auto" value={`${t.semesters.gpa} ${formatGpa(gpa)}`} />
        </button>
      </div>

      <Collapse open={expanded} id={bodyId}>
        <div className="flex flex-col gap-4 border-t border-line/70 bg-surface/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="soft" size="sm" onClick={onAddCourse}>
              <Plus /> {t.semesters.addCourse}
            </Button>
            {isEditing ? (
              <>
                <Button variant="primary" size="sm" onClick={onSaveEdit}>
                  <Check /> {t.semesters.save}
                </Button>
                <Button variant="ghost" size="sm" onClick={onCancelEdit}>
                  <X /> {t.semesters.cancel}
                </Button>
                <Button variant="danger" size="sm" className="ms-auto" onClick={onDelete}>
                  <Trash2 /> {t.semesters.remove}
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={onBeginEdit}>
                <Pencil /> {t.semesters.edit}
              </Button>
            )}
          </div>

          {isEditing && (
            <div className="grid gap-3 rounded-2xl border border-line bg-raised/50 p-4 sm:grid-cols-3">
              <Field label={t.semesters.year}>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={editDraft.academicYear}
                  onChange={(event) => onEditDraftChange({ academicYear: event.target.value })}
                />
              </Field>
              <Field label={t.semesters.semesterNumber}>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={editDraft.semesterNumber}
                  onChange={(event) => onEditDraftChange({ semesterNumber: event.target.value })}
                />
              </Field>
              <Field label={t.semesters.season}>
                <Select
                  value={editDraft.season}
                  onValueChange={(value) => onEditDraftChange({ season: value as SemesterSeason })}
                >
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
          )}

          <CourseList
            courses={semester.courses}
            searchQuery={searchQuery}
            matches={matches}
            editingCourseId={editingCourseId}
            editingDraft={editingCourseDraft}
            editingError={editingCourseError}
            onEditingDraftChange={onEditingCourseDraftChange}
            onBeginEdit={onBeginEditCourse}
            onSaveEdit={onSaveEditCourse}
            onCancelEdit={onCancelEditCourse}
            onDelete={onDeleteCourse}
          />
        </div>
      </Collapse>
    </article>
  );
}
