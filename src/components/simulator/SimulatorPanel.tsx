import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Drawer } from "vaul";
import { Check, ChevronsUpDown, Eraser, GripVertical, Minus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Checkbox, CheckboxField } from "@/components/ui/toggle";
import { Badge, Banner } from "@/components/ui/surface";
import { Chevron, Collapse } from "@/components/ui/collapse";
import { TONE_BG } from "@/components/semesters/SemesterCard";
import { cn } from "@/lib/utils";
import { deltaTone, formatDelta, formatNumber, yearTone } from "@/lib/format";
import { seasonLabel, t } from "@/lib/i18n";
import { formatGpa } from "@/calculations";
import { BINARY_SORT_MODES, type useSimulator } from "@/hooks/useSimulator";
import { useIsDesktop } from "@/hooks/useMediaQuery";
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
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
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
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
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
              return (
                <li
                  key={course.key}
                  className={cn(
                    "stagger flex items-center gap-3 rounded-2xl border p-3",
                    isSelected ? "border-primary/40" : "border-line",
                    TONE_BG[yearTone(course.academicYear)]
                  )}
                  style={{ "--index": index } as React.CSSProperties}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => simulator.toggleSelected(course.key, checked === true)}
                    aria-label={t.simulator.simulateAria(course.courseName)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-strong">{course.courseName}</p>
                    <p className="tnum mt-1 text-2xs text-ink-faint">
                      {t.semesters.yearLabel(course.academicYear)} · {course.semesterNumber} ·{" "}
                      {seasonLabel(course.season)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="outline" className="tnum">
                      {course.grade}
                    </Badge>
                    <Badge className="tnum">{formatNumber(course.credits)}</Badge>
                    <span className="tnum hidden w-16 text-end text-xs text-ink-muted sm:block">
                      {formatGpa(course.soloGpa)}
                    </span>
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

interface SimulatorPanelProps extends SimulatorBodyProps {
  mode: "closed" | "open" | "tab";
  onModeChange: (mode: "closed" | "open" | "tab") => void;
}

export function SimulatorPanel({ mode, onModeChange, ...bodyProps }: SimulatorPanelProps) {
  const isDesktop = useIsDesktop();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (mode !== "open") return;

    // Escape minimises rather than closes so an in-progress selection is not lost.
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onModeChange("tab");
    }

    function handleResize() {
      setPosition((prev) => (prev ? clamp(prev.x, prev.y) : prev));
    }

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [mode, onModeChange]);

  function clamp(x: number, y: number) {
    const panel = panelRef.current;
    const width = panel?.offsetWidth ?? 560;
    const height = panel?.offsetHeight ?? 400;
    return {
      x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - width - 8)),
      y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - height - 8))
    };
  }

  function handleDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    dragOffsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };

    // Pin the current geometry so the CSS end/bottom anchoring stops fighting left/top.
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";

    event.currentTarget.setPointerCapture(event.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);
  }

  // Writes straight to the DOM during the drag; committing to state per pointermove
  // re-renders the whole simulator list and makes it stutter.
  function handleDragMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;

    const panel = panelRef.current;
    if (!panel) return;

    const offset = dragOffsetRef.current;
    const next = clamp(event.clientX - offset.x, event.clientY - offset.y);
    panel.style.left = `${next.x}px`;
    panel.style.top = `${next.y}px`;
  }

  function handleDragEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);

    const panel = panelRef.current;
    if (panel) {
      setPosition({ x: parseFloat(panel.style.left) || 0, y: parseFloat(panel.style.top) || 0 });
    }
    setIsDragging(false);
  }

  if (mode === "tab") {
    return (
      <Button
        variant="primary"
        size="sm"
        className="fixed bottom-6 end-6 z-40 shadow-float"
        onClick={() => onModeChange("open")}
      >
        <Sparkles /> {t.simulator.title}
      </Button>
    );
  }

  if (mode !== "open") return null;

  if (!isDesktop) {
    return (
      <Drawer.Root open onOpenChange={(open) => !open && onModeChange("closed")} repositionInputs={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/45" />
          <Drawer.Content className="pb-safe fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-sheet border-t border-line bg-surface outline-none">
            <div className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
            <Drawer.Title className="px-5 pb-3 pt-4 text-lg text-ink-strong">{t.simulator.title}</Drawer.Title>
            <div className="scroll-region min-h-0 flex-1 px-5 pb-5">
              <SimulatorBody {...bodyProps} />
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t.simulator.title}
      className={cn(
        "fixed bottom-6 end-6 z-40 flex max-h-[80dvh] w-[min(40rem,calc(100vw-3rem))] flex-col",
        "animate-enter rounded-3xl border border-line bg-surface shadow-float",
        isDragging && "[&_*]:pointer-events-none"
      )}
      style={position ? { left: `${position.x}px`, top: `${position.y}px`, right: "auto", bottom: "auto" } : undefined}
    >
      <div
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-t-3xl border-b border-line px-4 py-3",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <GripVertical className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-strong">{t.simulator.title}</span>
        <Button variant="ghost" size="icon-sm" onClick={() => onModeChange("tab")} aria-label={t.simulator.hide}>
          <Minus />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => onModeChange("closed")} aria-label={t.simulator.close}>
          <X />
        </Button>
      </div>

      <div className="scroll-region min-h-0 flex-1 p-4">
        <SimulatorBody {...bodyProps} />
      </div>
    </div>
  );
}
