import { ChevronsDownUp, ChevronsUpDown, Plus, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Card, EmptyState, GpaPill, SectionHeading } from "@/components/ui/surface";
import { Chevron, Collapse } from "@/components/ui/collapse";
import { SemesterCard, TONE_BG, TONE_BORDER } from "@/components/semesters/SemesterCard";
import { cn } from "@/lib/utils";
import { formatNumber, yearTone } from "@/lib/format";
import { t } from "@/lib/i18n";
import { formatGpa } from "@/calculations";
import type { useSemesterBrowser } from "@/hooks/useSemesterBrowser";
import type { CourseDraft, SemesterDraft } from "@/lib/drafts";
import type { Course, Profile, Semester } from "@/types";

interface DashboardScreenProps {
  activeProfile: Profile | null;
  overallGpa: number | null;
  totalCredits: number;
  annualGpas: Record<number, number | null>;
  browser: ReturnType<typeof useSemesterBrowser>;
  onOpenAddSemester: () => void;
  onOpenSimulator: () => void;
  editingSemesterId: string | null;
  editingSemesterDraft: SemesterDraft;
  onEditingSemesterDraftChange: (patch: Partial<SemesterDraft>) => void;
  onBeginEditSemester: (semester: Semester) => void;
  onSaveEditSemester: (semesterId: string) => void;
  onCancelEditSemester: () => void;
  onDeleteSemester: (semesterId: string) => void;
  onAddCourse: (semesterId: string) => void;
  editingCourseId: string | null;
  editingCourseDraft: CourseDraft;
  editingCourseError: string | null;
  onEditingCourseDraftChange: (patch: Partial<CourseDraft>) => void;
  onBeginEditCourse: (course: Course) => void;
  onSaveEditCourse: (semesterId: string) => void;
  onCancelEditCourse: () => void;
  onDeleteCourse: (semesterId: string, courseId: string) => void;
  registerSemesterNode: (semesterId: string, node: HTMLElement | null) => void;
}

function StatCard({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <Card
      className="stagger flex flex-col gap-2 p-6 transition-transform duration-300 ease-out hover:-translate-y-0.5"
      style={{ "--index": index } as React.CSSProperties}
    >
      <span className="text-xs font-semibold tracking-wide text-ink-faint">{label}</span>
      <span className="tnum font-display text-2xl font-normal leading-none text-ink-strong">{value}</span>
    </Card>
  );
}

export function DashboardScreen(props: DashboardScreenProps) {
  const { activeProfile, overallGpa, totalCredits, annualGpas, browser } = props;

  if (!activeProfile) {
    return <EmptyState>{t.profiles.emptyState}</EmptyState>;
  }

  const annualYears = Object.keys(annualGpas)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            type="search"
            className="ps-11 pe-11"
            placeholder={t.search.placeholder}
            aria-label={t.search.label}
            value={browser.query}
            onChange={(event) => browser.setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") browser.setQuery("");
            }}
          />
          {browser.isSearching && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute end-1.5 top-1/2 -translate-y-1/2"
              onClick={() => browser.setQuery("")}
              aria-label={t.search.clear}
            >
              <X />
            </Button>
          )}
        </div>
        <Button variant="primary" onClick={props.onOpenAddSemester} className="shrink-0">
          <Plus /> {t.semesters.add}
        </Button>
      </div>

      {browser.isSearching && (
        <p className="-mt-4 px-1 text-sm text-ink-muted">
          {browser.matchCount === 0
            ? t.search.noMatch(browser.query.trim())
            : t.search.summary(browser.matchCount, browser.matchesBySemester.size)}
        </p>
      )}

      {!browser.isSearching && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label={t.stats.overallGpa} value={formatGpa(overallGpa)} index={0} />
            <StatCard label={t.stats.totalCredits} value={formatNumber(totalCredits)} index={1} />
          </div>

          <section className="flex flex-col gap-3">
            <SectionHeading title={t.stats.annualGpa} />
            {annualYears.length === 0 ? (
              <p className="px-1 text-sm text-ink-faint">{t.stats.noAnnualGpa}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {annualYears.map((year, index) => (
                  <div
                    key={year}
                    className={cn(
                      "stagger flex items-center gap-3 rounded-2xl border px-4 py-3",
                      TONE_BORDER[yearTone(year)],
                      TONE_BG[yearTone(year)]
                    )}
                    style={{ "--index": index } as React.CSSProperties}
                  >
                    <span className="text-xs text-ink-muted">{t.stats.academicYear} {year}</span>
                    <strong className="tnum font-display text-base font-normal text-ink-strong">
                      {formatGpa(annualGpas[year] ?? null)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <Card className="flex flex-col gap-4 p-6">
            <SectionHeading
              title={
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {t.simulator.title}
                </span>
              }
              hint={t.simulator.description}
            />
            <Button variant="soft" className="self-start" onClick={props.onOpenSimulator}>
              {t.simulator.open}
            </Button>
          </Card>
        </>
      )}

      <section className="flex flex-col gap-3">
        {!browser.isSearching && browser.sortedSemesters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" disabled={!browser.canCollapseAll} onClick={browser.collapseAll}>
              <ChevronsDownUp /> {t.semesters.collapseAll}
            </Button>
            <Button variant="ghost" size="sm" disabled={!browser.canExpandAll} onClick={browser.expandAll}>
              <ChevronsUpDown /> {t.semesters.expandAll}
            </Button>
          </div>
        )}

        {browser.visibleYearGroups.map((group) => {
          const tone = yearTone(group.year);
          const expanded = browser.isYearExpanded(group.year, group.matchCount);
          const bodyId = `year_body_${group.year}`;

          return (
            <div key={group.year} className={cn("rounded-3xl border", TONE_BORDER[tone], TONE_BG[tone])}>
              <button
                type="button"
                onClick={() => browser.toggleYear(group.year)}
                disabled={browser.isSearching}
                aria-expanded={expanded}
                aria-controls={bodyId}
                className="press flex w-full flex-wrap items-center gap-2 rounded-3xl px-4 py-4 text-start disabled:pointer-events-none"
              >
                <Chevron open={expanded} />
                <span className="font-display text-base font-normal text-ink-strong">
                  {t.semesters.yearLabel(group.year)}
                </span>
                <Badge>{group.semesters.length}</Badge>
                <Badge>{t.semesters.counts(group.courseCount)}</Badge>
                <Badge>{t.semesters.credits(formatNumber(group.credits))}</Badge>
                <GpaPill className="ms-auto" value={`${t.semesters.gpa} ${formatGpa(group.gpa)}`} />
              </button>

              <Collapse open={expanded} id={bodyId}>
                <div className="flex flex-col gap-2.5 p-2.5 pt-0">
                  {group.semesters.map((semester) => (
                    <SemesterCard
                      key={semester.id}
                      semester={semester}
                      tone={tone}
                      expanded={browser.isSemesterExpanded(semester.id)}
                      toggleDisabled={browser.isSearching}
                      onToggle={() => browser.toggleSemester(semester.id)}
                      matches={browser.matchesBySemester.get(semester.id)}
                      searchQuery={browser.normalizedQuery}
                      isEditing={props.editingSemesterId === semester.id}
                      editDraft={props.editingSemesterDraft}
                      onEditDraftChange={props.onEditingSemesterDraftChange}
                      onBeginEdit={() => props.onBeginEditSemester(semester)}
                      onSaveEdit={() => props.onSaveEditSemester(semester.id)}
                      onCancelEdit={props.onCancelEditSemester}
                      onDelete={() => props.onDeleteSemester(semester.id)}
                      onAddCourse={() => props.onAddCourse(semester.id)}
                      editingCourseId={props.editingCourseId}
                      editingCourseDraft={props.editingCourseDraft}
                      editingCourseError={props.editingCourseError}
                      onEditingCourseDraftChange={props.onEditingCourseDraftChange}
                      onBeginEditCourse={props.onBeginEditCourse}
                      onSaveEditCourse={() => props.onSaveEditCourse(semester.id)}
                      onCancelEditCourse={props.onCancelEditCourse}
                      onDeleteCourse={(courseId) => props.onDeleteCourse(semester.id, courseId)}
                      cardRef={(node) => props.registerSemesterNode(semester.id, node)}
                    />
                  ))}
                </div>
              </Collapse>
            </div>
          );
        })}

        {browser.sortedSemesters.length === 0 && <EmptyState>{t.semesters.empty}</EmptyState>}
        {browser.isSearching && browser.matchCount === 0 && browser.sortedSemesters.length > 0 && (
          <EmptyState>{t.search.noMatchLong(browser.query.trim())}</EmptyState>
        )}
      </section>
    </div>
  );
}
