import { useEffect, useMemo, useState } from "react";
import { aggregateCourses, gpaAfterBinarizing } from "@/calculations";
import { sortSemesters } from "@/lib/drafts";
import type { Profile, Semester, SemesterSeason } from "@/types";

export type BinarySortMode = "impact" | "grade" | "credits" | "chronological";

export interface BinaryCandidate {
  key: string;
  courseId: string;
  semesterId: string;
  academicYear: number;
  semesterNumber: number;
  season: SemesterSeason;
  courseName: string;
  credits: number;
  grade: number;
  gapFromOverall: number;
  impactScore: number;
  soloGpa: number | null;
  soloDelta: number | null;
}

export const BINARY_SORT_MODES: BinarySortMode[] = ["impact", "grade", "credits", "chronological"];

export function useSimulator(
  activeProfile: Profile | null,
  overallGpa: number | null,
  sortedSemesters: Semester[]
) {
  const [sortMode, setSortMode] = useState<BinarySortMode>("impact");
  const [showAll, setShowAll] = useState(false);
  const [semesterFilterById, setSemesterFilterById] = useState<Record<string, boolean>>({});
  const [selectedByKey, setSelectedByKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSemesterFilterById((prev) => {
      const next: Record<string, boolean> = {};
      for (const semester of sortedSemesters) {
        next[semester.id] = prev[semester.id] ?? true;
      }

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const unchanged = prevKeys.length === nextKeys.length && nextKeys.every((id) => prev[id] === next[id]);
      return unchanged ? prev : next;
    });
  }, [sortedSemesters]);

  const baseAggregation = useMemo(
    () => aggregateCourses(activeProfile ? activeProfile.semesters.flatMap((semester) => semester.courses) : []),
    [activeProfile]
  );

  const existingBinaryCredits = useMemo(() => {
    if (!activeProfile) return 0;
    return activeProfile.semesters
      .flatMap((semester) => semester.courses)
      .filter((course) => course.isBinaryPass)
      .reduce((sum, course) => sum + course.credits, 0);
  }, [activeProfile]);

  const coursesBelowOverall = useMemo<BinaryCandidate[]>(() => {
    if (!activeProfile || overallGpa === null) return [];

    return sortSemesters(activeProfile.semesters).flatMap((semester) =>
      semester.courses
        .filter((course) => !course.isBinaryPass && course.grade !== null && course.grade < overallGpa)
        .map((course) => {
          const grade = course.grade as number;
          const soloGpa = gpaAfterBinarizing(baseAggregation, [{ grade, credits: course.credits }]);
          return {
            key: `${semester.id}_${course.id}`,
            courseId: course.id,
            semesterId: semester.id,
            academicYear: semester.academicYear,
            semesterNumber: semester.semesterNumber,
            season: semester.season,
            courseName: course.name,
            credits: course.credits,
            grade,
            gapFromOverall: overallGpa - grade,
            impactScore: (overallGpa - grade) * course.credits,
            soloGpa,
            soloDelta: soloGpa === null ? null : soloGpa - overallGpa
          };
        })
    );
  }, [activeProfile, baseAggregation, overallGpa]);

  const rankedCourses = useMemo(() => {
    const filtered = coursesBelowOverall.filter((course) => semesterFilterById[course.semesterId] ?? true);
    switch (sortMode) {
      case "grade":
        return [...filtered].sort((a, b) => a.grade - b.grade);
      case "credits":
        return [...filtered].sort((a, b) => b.credits - a.credits);
      case "chronological":
        return filtered;
      default:
        return [...filtered].sort((a, b) => b.impactScore - a.impactScore);
    }
  }, [coursesBelowOverall, semesterFilterById, sortMode]);

  useEffect(() => {
    setSelectedByKey((prev) => {
      const allowed = new Set(rankedCourses.map((course) => course.key));
      const next = Object.fromEntries(
        Object.entries(prev).filter(([key, value]) => value && allowed.has(key))
      ) as Record<string, boolean>;

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const unchanged = prevKeys.length === nextKeys.length && nextKeys.every((key) => prev[key] === next[key]);
      return unchanged ? prev : next;
    });
  }, [rankedCourses]);

  const visibleCourses = useMemo(
    () => (showAll ? rankedCourses : rankedCourses.slice(0, 5)),
    [rankedCourses, showAll]
  );

  const selectedCourses = useMemo(
    () => rankedCourses.filter((course) => selectedByKey[course.key]),
    [rankedCourses, selectedByKey]
  );

  const simulatedGpa = useMemo(() => {
    if (selectedCourses.length === 0) return overallGpa;
    return gpaAfterBinarizing(
      baseAggregation,
      selectedCourses.map((course) => ({ grade: course.grade, credits: course.credits }))
    );
  }, [baseAggregation, overallGpa, selectedCourses]);

  const simulatedDelta = simulatedGpa === null || overallGpa === null ? null : simulatedGpa - overallGpa;
  const selectedBinaryCredits = selectedCourses.reduce((sum, course) => sum + course.credits, 0);
  const projectedBinaryCredits = existingBinaryCredits + selectedBinaryCredits;
  const creditCap = activeProfile?.binaryCreditCap ?? null;

  return {
    sortMode,
    setSortMode,
    showAll,
    setShowAll,
    semesterFilterById,
    setSemesterFilter: (semesterId: string, checked: boolean) =>
      setSemesterFilterById((prev) => ({ ...prev, [semesterId]: checked })),
    setAllSemesterFilters: (selected: boolean) =>
      setSemesterFilterById(() => Object.fromEntries(sortedSemesters.map((semester) => [semester.id, selected]))),
    selectedByKey,
    toggleSelected: (key: string, selected: boolean) =>
      setSelectedByKey((prev) => ({ ...prev, [key]: selected })),
    clearSelection: () => setSelectedByKey({}),
    coursesBelowOverall,
    rankedCourses,
    visibleCourses,
    selectedCourses,
    simulatedGpa,
    simulatedDelta,
    existingBinaryCredits,
    selectedBinaryCredits,
    projectedBinaryCredits,
    creditCap,
    isOverCap: creditCap !== null && projectedBinaryCredits > creditCap,
    selectedSemesterCount: sortedSemesters.filter((semester) => semesterFilterById[semester.id] ?? true).length
  };
}
