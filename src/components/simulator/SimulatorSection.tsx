import { useState } from "react";
import { Check, ChevronsUpDown, Eraser, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Checkbox, CheckboxField } from "@/components/ui/toggle";
import { Badge, Banner, Card } from "@/components/ui/surface";
import { Chevron, Collapse } from "@/components/ui/collapse";
import { TONE_BG, TONE_BORDER } from "@/components/semesters/SemesterCard";
import { cn } from "@/lib/utils";
import { deltaTone, formatDelta, formatNumber, yearTone } from "@/lib/format";
import { seasonLabel, t } from "@/lib/i18n";
import { formatGpa } from "@/calculations";
import { BINARY_SORT_MODES, type useSimulator } from "@/hooks/useSimulator";
import type { Semester } from "@/types";

type Simulator = ReturnType<typeof useSimulator>;

const DELTA_TONE_CLASS = {
  flat: "text-ink-faint",
  up: "text-positive",
  down: "text-critical"
} as const;

function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  return <span className={cn("tnum text-2xs font-bold", DELTA_TONE_CLASS[deltaTone(value)])}>{formatDelta(value)}</span>;
}

function Tile({ label, children, note }: { label: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-raised/50 p-3.5">
      <span className="text-2xs font-semibold tracking-wide text-ink-faint">{label}</span>
      <span className="tnum flex items-baseline gap-1.5 font-display text-lg font-normal text-ink-strong">{children}</span>
      {note && <span className="text-2xs leading-relaxed text-ink-faint">{note}</span>}
    </div>
  );
}

interface SimulatorBodyProps {
  simulator: Simulator;
  overallGpa: number | null;
  sortedSemesters: Semester[];
  onCreditCapChange: (value: string) => void;
  onApply: () => void;
}

function SimulatorBody({ simulator, overallGpa, sortedSemesters, onCreditCapChange, onApply }: SimulatorBodyProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  if (overallGpa === null) {
    return <p className="py-8 text-center text-sm text-ink-muted">{t.simulator.noGpa}</p>;
  }

  if (simulator.coursesBelowOverall.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">{t.simulator.allAbove(formatGpa(overallGpa))}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label={t.simulator.currentGpa}>{formatGpa(overallGpa)}</Tile>
        <Tile
          label={t.simulator.simulatedGpa}
          note={
            simulator.selectedCourses.length === 0
              ? t.simulator.nothingSelected
              : t.simulator.selectedCount(simulator.selectedCourses.length)
          }
        >
          {formatGpa(simulator.simulatedGpa)}
          <Delta value={simulator.simulatedDelta} />
        </Tile>
        <Tile
          label={t.simulator.binaryCredits}
          note={t.simulator.creditsBreakdown(
            formatNumber(simulator.existingBinaryCredits),
            formatNumber(simulator.selectedBinaryCredits)
          )}
        >
          {formatNumber(simulator.projectedBinaryCredits)}
          {simulator.creditCap !== null && (
            <span className="text-sm font-normal text-ink-faint">/ {formatNumber(simulator.creditCap)}</span>
          )}
        </Tile>
        <Field label={t.simulator.creditCap} hint={t.simulator.capHint}>
          <Input
            type="number"
            min={0}
            step={0.5}
            inputMode="decimal"
            placeholder={t.simulator.noLimit}
            value={simulator.creditCap ?? ""}
            onChange={(event) => onCreditCapChange(event.target.value)}
          />
        </Field>
      </div>

      {simulator.isOverCap && (
        <Banner tone="warning">
          {t.simulator.overCap(
            formatNumber(simulator.projectedBinaryCredits),
            formatNumber(simulator.projectedBinaryCredits - (simulator.creditCap ?? 0)),
            formatNumber(simulator.creditCap ?? 0)
          )}
        </Banner>
      )}
      {simulator.simulatedGpa === null && <Banner tone="warning">{t.simulator.noGradedLeft}</Banner>}

      <div className="rounded-2xl border border-line">
        <button
          type="button"
          onClick={() => setFilterOpen((prev) => !prev)}
          aria-expanded={filterOpen}
          className="press flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-start text-sm text-ink"
        >
          <Chevron open={filterOpen} />
          {t.simulator.filterSemesters(simulator.selectedSemesterCount, sortedSemesters.length)}
        </button>
        <Collapse open={filterOpen}>
          <div className="border-t border-line p-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => simulator.setAllSemesterFilters(true)}>
                <Check /> {t.simulator.selectAll}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => simulator.setAllSemesterFilters(false)}>
                <X /> {t.simulator.clearAll}
              </Button>
            </div>
            <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {sortedSemesters.map((semester) => (
                <CheckboxField
                  key={semester.id}
                  checked={simulator.semesterFilterById[semester.id] ?? true}
                  onCheckedChange={(checked) => simulator.setSemesterFilter(semester.id, checked === true)}
                >
                  <span className="text-xs">
                    {t.semesters.yearLabel(semester.academicYear)} · {semester.semesterNumber} ·{" "}
                    {seasonLabel(semester.season)}
                  </span>
                </CheckboxField>
              ))}
            </div>
          </div>
        </Collapse>
      </div>

      {simulator.rankedCourses.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">{t.simulator.noMatching}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="me-1 text-2xs font-semibold tracking-wide text-ink-faint">{t.simulator.sortBy}</span>
            {BINARY_SORT_MODES.map((mode) => (
              <Button
                key={mode}
                variant={simulator.sortMode === mode ? "soft" : "ghost"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => simulator.setSortMode(mode)}
              >
                {t.simulator.sortOptions[mode]}
              </Button>
            ))}
          </div>

          <ul className="flex flex-col gap-1.5">
            {simulator.visibleCourses.map((course, index) => {
              const isSelected = simulator.selectedByKey[course.key] ?? false;
              const tone = yearTone(course.academicYear);
              return (
                <li
                  key={course.key}
                  className={cn(
                    "stagger flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border p-3",
                    isSelected ? "border-primary/40" : TONE_BORDER[tone],
                    TONE_BG[tone]
                  )}
                  style={{ "--index": index } as React.CSSProperties}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => simulator.toggleSelected(course.key, checked === true)}
                    aria-label={t.simulator.simulateAria(course.courseName)}
                  />
                  <div className="min-w-[9rem] flex-1">
                    <p className="text-sm font-medium text-ink-strong">{course.courseName}</p>
                    <p className="tnum mt-1 text-2xs text-ink-faint">
                      {t.semesters.yearLabel(course.academicYear)} · {course.semesterNumber} ·{" "}
                      {seasonLabel(course.season)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="tnum">
                      {course.grade}
                    </Badge>
                    <Badge className="tnum">{t.semesters.credits(formatNumber(course.credits))}</Badge>
                    <Badge variant="outline" className="tnum">
                      {t.simulator.ifOnlyThis} {formatGpa(course.soloGpa)}
                    </Badge>
                    <Delta value={course.soloDelta} />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            {simulator.rankedCourses.length > 5 && (
              <Button variant="ghost" size="sm" onClick={() => simulator.setShowAll(!simulator.showAll)}>
                <ChevronsUpDown />
                {simulator.showAll ? t.simulator.showTop : t.simulator.showAll(simulator.rankedCourses.length)}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={simulator.selectedCourses.length === 0}
              onClick={simulator.clearSelection}
            >
              <Eraser /> {t.simulator.clearSelection}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="ms-auto"
              disabled={simulator.selectedCourses.length === 0}
              onClick={onApply}
            >
              <Sparkles /> {t.simulator.apply(simulator.selectedCourses.length)}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

interface SimulatorSectionProps extends SimulatorBodyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SimulatorSection({ open, onOpenChange, ...bodyProps }: SimulatorSectionProps) {
  const bodyId = "simulator_body";

  return (
    <Card className="overflow-hidden">
      <h3>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="press flex w-full items-start gap-3 px-5 py-5 text-start sm:px-6"
        >
          <Chevron open={open} className="mt-1.5" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-lg text-ink-strong">
              <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {t.simulator.title}
            </span>
            <span className="mt-1 block max-w-prose text-sm leading-relaxed text-ink-muted">
              {t.simulator.description}
            </span>
          </span>
        </button>
      </h3>

      <Collapse open={open} id={bodyId}>
        <div className="border-t border-line p-4 sm:p-6">
          <SimulatorBody {...bodyProps} />
        </div>
      </Collapse>
    </Card>
  );
}
