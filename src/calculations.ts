import type { Course, Profile } from "./types";

export interface GpaAggregation {
  qualityPoints: number;
  gradedCredits: number;
}

function toGpa(aggregation: GpaAggregation): number | null {
  if (aggregation.gradedCredits <= 0) {
    return null;
  }

  return aggregation.qualityPoints / aggregation.gradedCredits;
}

export function aggregateCourses(courses: Course[]): GpaAggregation {
  return courses.reduce<GpaAggregation>(
    (acc, course) => {
      if (!course.isBinaryPass && typeof course.grade === "number") {
        acc.qualityPoints += course.grade * course.credits;
        acc.gradedCredits += course.credits;
      }
      return acc;
    },
    { qualityPoints: 0, gradedCredits: 0 }
  );
}

export function calculateSemesterGpa(courses: Course[]): number | null {
  return toGpa(aggregateCourses(courses));
}

export function calculateAnnualGpas(profile: Profile): Record<number, number | null> {
  const byYear = new Map<number, Course[]>();

  for (const semester of profile.semesters) {
    const existing = byYear.get(semester.academicYear) ?? [];
    existing.push(...semester.courses);
    byYear.set(semester.academicYear, existing);
  }

  const result: Record<number, number | null> = {};
  for (const [year, courses] of byYear.entries()) {
    result[year] = calculateSemesterGpa(courses);
  }

  return result;
}

export function calculateOverallGpa(profile: Profile): number | null {
  const allCourses = profile.semesters.flatMap((s) => s.courses);
  return calculateSemesterGpa(allCourses);
}

export function calculateTotalEarnedCredits(profile: Profile): number {
  return profile.semesters
    .flatMap((semester) => semester.courses)
    .reduce((sum, course) => sum + course.credits, 0);
}

// Subtracts the given graded courses from a precomputed aggregate so each simulation stays O(1).
export function gpaAfterBinarizing(
  base: GpaAggregation,
  binarized: Array<{ grade: number; credits: number }>
): number | null {
  const removed = binarized.reduce<GpaAggregation>(
    (acc, course) => {
      acc.qualityPoints += course.grade * course.credits;
      acc.gradedCredits += course.credits;
      return acc;
    },
    { qualityPoints: 0, gradedCredits: 0 }
  );

  return toGpa({
    qualityPoints: base.qualityPoints - removed.qualityPoints,
    gradedCredits: base.gradedCredits - removed.gradedCredits
  });
}

export function formatGpa(value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  return value.toFixed(2);
}
