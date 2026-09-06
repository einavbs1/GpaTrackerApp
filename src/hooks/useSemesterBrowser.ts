import { useCallback, useMemo, useState } from "react";
import { sortSemesters } from "@/lib/drafts";
import type { Profile, Semester } from "@/types";

export interface YearGroup {
  year: number;
  semesters: Semester[];
  gpa: number | null;
  courseCount: number;
  credits: number;
  matchCount: number;
}

/** Search, year grouping and collapse state for the semester browser. */
export function useSemesterBrowser(activeProfile: Profile | null, annualGpas: Record<number, number | null>) {
  const [query, setQuery] = useState("");
  const [collapsedSemesterById, setCollapsedSemesterById] = useState<Record<string, boolean>>({});
  const [collapsedYearByNumber, setCollapsedYearByNumber] = useState<Record<number, boolean>>({});

  const sortedSemesters = useMemo(
    () => (activeProfile ? sortSemesters(activeProfile.semesters) : []),
    [activeProfile]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const matchesBySemester = useMemo(() => {
    const matches = new Map<string, Set<string>>();
    if (!isSearching) return matches;

    for (const semester of sortedSemesters) {
      const hits = semester.courses
        .filter(
          (course) =>
            course.name.toLowerCase().includes(normalizedQuery) || course.code.toLowerCase().includes(normalizedQuery)
        )
        .map((course) => course.id);
      if (hits.length > 0) {
        matches.set(semester.id, new Set(hits));
      }
    }

    return matches;
  }, [isSearching, normalizedQuery, sortedSemesters]);

  const matchCount = useMemo(() => {
    let total = 0;
    for (const hits of matchesBySemester.values()) total += hits.size;
    return total;
  }, [matchesBySemester]);

  const groupsByYear = useMemo<YearGroup[]>(() => {
    const byYear = new Map<number, Semester[]>();
    for (const semester of sortedSemesters) {
      const existing = byYear.get(semester.academicYear) ?? [];
      existing.push(semester);
      byYear.set(semester.academicYear, existing);
    }

    return [...byYear.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, semesters]) => {
        const courses = semesters.flatMap((semester) => semester.courses);
        return {
          year,
          semesters,
          gpa: annualGpas[year] ?? null,
          courseCount: courses.length,
          credits: courses.reduce((sum, course) => sum + course.credits, 0),
          matchCount: semesters.reduce((sum, semester) => sum + (matchesBySemester.get(semester.id)?.size ?? 0), 0)
        };
      });
  }, [annualGpas, matchesBySemester, sortedSemesters]);

  const visibleYearGroups = useMemo(() => {
    if (!isSearching) return groupsByYear;
    return groupsByYear
      .filter((group) => group.matchCount > 0)
      .map((group) => ({
        ...group,
        semesters: group.semesters.filter((semester) => matchesBySemester.has(semester.id))
      }));
  }, [groupsByYear, isSearching, matchesBySemester]);

  // Semesters default to collapsed, years default to expanded.
  const isSemesterExpanded = useCallback(
    (semesterId: string) =>
      isSearching ? matchesBySemester.has(semesterId) : !(collapsedSemesterById[semesterId] ?? true),
    [collapsedSemesterById, isSearching, matchesBySemester]
  );

  const isYearExpanded = useCallback(
    (year: number, groupMatchCount: number) =>
      isSearching ? groupMatchCount > 0 : !(collapsedYearByNumber[year] ?? false),
    [collapsedYearByNumber, isSearching]
  );

  const toggleSemester = useCallback((semesterId: string) => {
    setCollapsedSemesterById((prev) => ({ ...prev, [semesterId]: !(prev[semesterId] ?? true) }));
  }, []);

  const toggleYear = useCallback((year: number) => {
    setCollapsedYearByNumber((prev) => ({ ...prev, [year]: !(prev[year] ?? false) }));
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedSemesterById((prev) => ({
      ...prev,
      ...Object.fromEntries(sortedSemesters.map((semester) => [semester.id, false]))
    }));
    setCollapsedYearByNumber({});
  }, [sortedSemesters]);

  const collapseAll = useCallback(() => {
    setCollapsedSemesterById((prev) => ({
      ...prev,
      ...Object.fromEntries(sortedSemesters.map((semester) => [semester.id, true]))
    }));
  }, [sortedSemesters]);

  const expandSemester = useCallback((semesterId: string, year: number) => {
    setCollapsedSemesterById((prev) => ({ ...prev, [semesterId]: false }));
    setCollapsedYearByNumber((prev) => ({ ...prev, [year]: false }));
    setQuery("");
  }, []);

  const forgetSemester = useCallback((semesterId: string) => {
    setCollapsedSemesterById((prev) => {
      const { [semesterId]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  return {
    query,
    setQuery,
    normalizedQuery,
    isSearching,
    matchesBySemester,
    matchCount,
    sortedSemesters,
    visibleYearGroups,
    isSemesterExpanded,
    isYearExpanded,
    toggleSemester,
    toggleYear,
    expandAll,
    collapseAll,
    expandSemester,
    forgetSemester,
    canExpandAll: sortedSemesters.some((semester) => collapsedSemesterById[semester.id] ?? true),
    canCollapseAll: sortedSemesters.some((semester) => !(collapsedSemesterById[semester.id] ?? true))
  };
}
