import "server-only";

import { db } from "@/lib/db";

export type PoTrackingRow = {
  purchaseOrderId: string;
  purchaseOrderCode: string;
  purchaseOrderName: string;
  purchaseOrderCourseEntryId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  packageCode: string;
  estimatedSeats: number;
  actualSeats: number;
  remainingSeats: number;
  fulfillmentPct: number;
  linkedTrainingsCount: number;
  overageFlag: boolean;
  shortfallFlag: boolean;
  zeroActualFlag: boolean;
};

export type PoTrackingSummary = {
  estimatedSeats: number;
  actualSeats: number;
  remainingSeats: number;
  fulfillmentPct: number;
  linkedTrainingsCount: number;
  overageFlag: boolean;
  shortfallFlag: boolean;
  zeroActualFlag: boolean;
};

export type PoCourseTrackingResult = {
  purchaseOrder: {
    id: string;
    code: string;
    name: string;
    nameAr: string | null;
    nameEn: string | null;
  };
  rows: PoTrackingRow[];
  summary: PoTrackingSummary;
};

function normalizeName(nameEn: string | null, nameAr: string | null, fallback: string) {
  return nameEn || nameAr || fallback;
}

function buildTrackingRow(entry: {
  scopeId: string;
  scopeCode: string;
  scopeName: string;
  courseRunCount: number;
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  packageCode: string;
  estimatedSeats: number | null;
  confirmedSeats: number[];
}): PoTrackingRow {
  const estimatedSeats = entry.estimatedSeats ?? 0;
  const actualSeats = entry.confirmedSeats.reduce((sum, value) => sum + value, 0);
  const remainingSeats = estimatedSeats - actualSeats;
  const fulfillmentPct = estimatedSeats > 0 ? (actualSeats / estimatedSeats) * 100 : 0;
  const linkedTrainingsCount = entry.courseRunCount;

  return {
    purchaseOrderId: entry.scopeId,
    purchaseOrderCode: entry.scopeCode,
    purchaseOrderName: entry.scopeName,
    purchaseOrderCourseEntryId: entry.id,
    courseId: entry.courseId,
    courseCode: entry.courseCode,
    courseName: entry.courseName,
    packageCode: entry.packageCode,
    estimatedSeats,
    actualSeats,
    remainingSeats,
    fulfillmentPct,
    linkedTrainingsCount,
    overageFlag: actualSeats > estimatedSeats,
    shortfallFlag: actualSeats < estimatedSeats,
    zeroActualFlag: linkedTrainingsCount > 0 && actualSeats === 0,
  };
}

function summarizeRows(rows: PoTrackingRow[]): PoTrackingSummary {
  const estimatedSeats = rows.reduce((sum, row) => sum + row.estimatedSeats, 0);
  const actualSeats = rows.reduce((sum, row) => sum + row.actualSeats, 0);
  const linkedTrainingsCount = rows.reduce((sum, row) => sum + row.linkedTrainingsCount, 0);
  const remainingSeats = estimatedSeats - actualSeats;

  return {
    estimatedSeats,
    actualSeats,
    remainingSeats,
    fulfillmentPct: estimatedSeats > 0 ? (actualSeats / estimatedSeats) * 100 : 0,
    linkedTrainingsCount,
    overageFlag: actualSeats > estimatedSeats,
    shortfallFlag: actualSeats < estimatedSeats,
    zeroActualFlag: linkedTrainingsCount > 0 && actualSeats === 0,
  };
}

export async function getPoCourseTracking(scopeId: string): Promise<PoCourseTrackingResult | null> {
  const scope = await db.projectScope.findUnique({
    where: { id: scopeId },
    select: {
      id: true,
      code: true,
      name: true,
      nameAr: true,
      nameEn: true,
      selectedCourses: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          scopeId: true,
          estimatedSeats: true,
          course: {
            select: {
              id: true,
              courseCode: true,
              nameAr: true,
              nameEn: true,
              package: { select: { code: true } },
            },
          },
          courseRuns: {
            select: {
              confirmedSeats: true,
            },
          },
        },
      },
    },
  });

  if (!scope) return null;

  const rows = scope.selectedCourses.map((entry) =>
    buildTrackingRow({
      scopeId: scope.id,
      scopeCode: scope.code,
      scopeName: normalizeName(scope.nameEn, scope.nameAr, scope.name),
      courseRunCount: entry.courseRuns.length,
      id: entry.id,
      courseId: entry.course.id,
      courseCode: entry.course.courseCode,
      courseName: normalizeName(entry.course.nameEn, entry.course.nameAr, entry.course.courseCode),
      packageCode: entry.course.package.code,
      estimatedSeats: entry.estimatedSeats,
      confirmedSeats: entry.courseRuns.map((run) => run.confirmedSeats),
    }),
  );

  return {
    purchaseOrder: {
      id: scope.id,
      code: scope.code,
      name: normalizeName(scope.nameEn, scope.nameAr, scope.name),
      nameAr: scope.nameAr,
      nameEn: scope.nameEn,
    },
    rows,
    summary: summarizeRows(rows),
  };
}

export async function getAllPoSummaryRows(): Promise<PoTrackingRow[]> {
  const entries = await db.projectScopeCourse.findMany({
    orderBy: [
      { scope: { code: "asc" } },
      { sortOrder: "asc" },
    ],
    select: {
      id: true,
      scopeId: true,
      estimatedSeats: true,
      scope: {
        select: {
          code: true,
          name: true,
          nameAr: true,
          nameEn: true,
        },
      },
      course: {
        select: {
          id: true,
          courseCode: true,
          nameAr: true,
          nameEn: true,
          package: { select: { code: true } },
        },
      },
      courseRuns: {
        select: {
          confirmedSeats: true,
        },
      },
    },
  });

  return entries.map((entry) =>
    buildTrackingRow({
      scopeId: entry.scopeId,
      scopeCode: entry.scope.code,
      scopeName: normalizeName(entry.scope.nameEn, entry.scope.nameAr, entry.scope.name),
      courseRunCount: entry.courseRuns.length,
      id: entry.id,
      courseId: entry.course.id,
      courseCode: entry.course.courseCode,
      courseName: normalizeName(entry.course.nameEn, entry.course.nameAr, entry.course.courseCode),
      packageCode: entry.course.package.code,
      estimatedSeats: entry.estimatedSeats,
      confirmedSeats: entry.courseRuns.map((run) => run.confirmedSeats),
    }),
  );
}

export async function getOverallPoFulfillment(): Promise<PoTrackingSummary> {
  const rows = await getAllPoSummaryRows();
  return summarizeRows(rows);
}
