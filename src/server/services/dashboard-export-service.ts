import "server-only";

import {
  CourseRunStatus,
  Prisma,
  TrainingEvaluationType,
} from "@prisma/client";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/locale";
import { t } from "@/lib/locale";
import { getOverallPoFulfillment } from "@/server/services/purchase-order-service";
import { getProjectFinancialOverview } from "@/server/services/training-financial-service";
import { getProjectQualityOverview } from "@/server/services/training-evaluation-service";
import {
  getCourseSessionAttendanceRate,
  getPackageSessionAttendanceRate,
  getProjectSessionAttendanceRate,
} from "@/server/services/capacity-service";
import { getProjectSummary } from "@/server/services/project-overview-service";

const completedRunStatuses: CourseRunStatus[] = [
  CourseRunStatus.COMPLETED,
  CourseRunStatus.CLOSED,
];

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  return value === null || value === undefined ? 0 : Number(value);
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function average(values: number[]) {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function formatNumber(value: number | null, locale: Locale) {
  if (value === null) return "-";
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number, locale: Locale) {
  return `${formatNumber(value, locale)}%`;
}

function formatCurrency(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: Date | null, locale: Locale) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function addWorksheet(
  workbook: XLSX.WorkBook,
  name: string,
  rows: Array<Array<string | number>>,
  widths: number[],
  rtl: boolean,
) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = widths.map((wch) => ({ wch }));
  worksheet["!views"] = [{ RTL: rtl }];
  XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
}

export async function buildDashboardWorkbook(locale: Locale) {
  const labels = t(locale);
  const rtl = locale === "ar";
  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: rtl }] };

  const [
    projectSummary,
    financialOverview,
    qualityOverview,
    attendanceOverview,
    poFulfillment,
    packages,
    courses,
    projectScopes,
  ] = await Promise.all([
    getProjectSummary(),
    getProjectFinancialOverview(),
    getProjectQualityOverview(),
    getProjectSessionAttendanceRate(),
    getOverallPoFulfillment(),
    db.package.findMany({
      orderBy: { code: "asc" },
      include: {
        courses: {
          include: {
            pricingRecords: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { finalUnitPriceWithoutTax: true },
            },
            runs: {
              include: {
                trainingEvaluations: {
                  select: { evaluationType: true, rating: true },
                },
              },
            },
            scopeSelections: { select: { estimatedSeats: true } },
          },
        },
      },
    }),
    db.course.findMany({
      orderBy: [{ package: { code: "asc" } }, { courseCode: "asc" }],
      include: {
        package: { select: { code: true, nameAr: true, nameEn: true } },
        runs: {
          include: {
            trainingEvaluations: {
              select: { evaluationType: true, rating: true },
            },
          },
        },
        scopeSelections: { select: { estimatedSeats: true } },
      },
    }),
    db.projectScope.findMany({
      orderBy: { code: "asc" },
      include: {
        selectedCourses: {
          include: {
            courseRuns: { select: { id: true, confirmedSeats: true } },
            course: {
              select: {
                nameAr: true,
                nameEn: true,
                package: { select: { code: true, nameAr: true, nameEn: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const totalTrainings = courses.reduce((sum, course) => sum + course.runs.length, 0);
  const completedTrainings = courses.reduce(
    (sum, course) =>
      sum + course.runs.filter((run) => completedRunStatuses.includes(run.status)).length,
    0,
  );
  const committedSeats = projectScopes.reduce(
    (sum, scope) =>
      sum + scope.selectedCourses.reduce((entrySum, entry) => entrySum + (entry.estimatedSeats ?? 0), 0),
    0,
  );
  const deliveredSeats = projectScopes.reduce(
    (sum, scope) =>
      sum +
      scope.selectedCourses.reduce(
        (entrySum, entry) =>
          entrySum + entry.courseRuns.reduce((runSum, run) => runSum + run.confirmedSeats, 0),
        0,
      ),
    0,
  );

  addWorksheet(
    workbook,
    labels.home.dashboardEyebrow,
    [
      [labels.dashboardOverview.financialTitle],
      [labels.dashboardOverview.totalRevenueRecognized, formatCurrency(decimalToNumber(financialOverview.totals.revenue), locale)],
      [labels.dashboardOverview.totalVendorCost, formatCurrency(decimalToNumber(financialOverview.totals.vendorCost), locale)],
      [labels.dashboardOverview.overallGrossMargin, formatPercent(financialOverview.totals.marginPct, locale)],
      [labels.projectOverview.totalProjectValue, formatCurrency(decimalToNumber(projectSummary.totalProjectValue), locale)],
      [labels.projectOverview.totalProjectInvoices, formatCurrency(decimalToNumber(projectSummary.totalProjectInvoices), locale)],
      [labels.projectOverview.totalCollectedValue, formatCurrency(decimalToNumber(projectSummary.totalCollectedValue), locale)],
      [labels.projectOverview.remainingUnbilledValue, formatCurrency(decimalToNumber(projectSummary.remainingUnbilledValue), locale)],
      [],
      [labels.dashboardOverview.deliveryTitle],
      [labels.dashboardOverview.trainingsPlannedCompleted, `${totalTrainings} / ${completedTrainings}`],
      [labels.dashboardOverview.seatsCommittedDelivered, `${committedSeats} / ${deliveredSeats}`],
      [labels.dashboardOverview.overallPoFulfillment, formatPercent(poFulfillment.fulfillmentPct, locale)],
      [labels.dashboardOverview.projectStartDate, formatDate(projectSummary.startDate, locale)],
      [labels.dashboardOverview.expectedEndDate, formatDate(projectSummary.expectedEndDate, locale)],
      [labels.dashboardOverview.baselineProgress, formatPercent(decimalToNumber(projectSummary.baselineProgress), locale)],
      [labels.dashboardOverview.actualProgress, formatPercent(decimalToNumber(projectSummary.actualProgress), locale)],
      [],
      [labels.dashboardOverview.qualityTitle],
      [labels.dashboardOverview.averageCourseRatingProject, formatNumber(qualityOverview.averageCourseRating, locale)],
      [labels.dashboardOverview.averageInstructorRatingProject, formatNumber(qualityOverview.averageInstructorRating, locale)],
      [labels.dashboardOverview.overallAttendanceRate, formatPercent(attendanceOverview.attendanceRate, locale)],
    ],
    [42, 28],
    rtl,
  );

  const packageAttendance = new Map(
    await Promise.all(
      packages.map(async (item) => [item.id, (await getPackageSessionAttendanceRate(item.id)).attendanceRate] as const),
    ),
  );
  addWorksheet(
    workbook,
    labels.dashboardOverview.packagePerformance,
    [
      [
        labels.dashboardOverview.package,
        labels.dashboardOverview.trainingsCompletedPlanned,
        labels.dashboardOverview.totalSeatsDelivered,
        labels.dashboardOverview.seatUtilization,
        labels.dashboardOverview.averageCourseRating,
        labels.dashboardOverview.averageInstructorRating,
        labels.dashboardOverview.attendanceRate,
        labels.dashboardOverview.revenueByPackage,
        labels.dashboardOverview.vendorCostByPackage,
        labels.dashboardOverview.grossMarginByPackage,
      ],
      ...packages.map((item) => {
        const runs = item.courses.flatMap((course) => course.runs);
        const plannedSeats = item.courses.reduce(
          (sum, course) => sum + course.scopeSelections.reduce((entrySum, entry) => entrySum + (entry.estimatedSeats ?? 0), 0),
          0,
        );
        const delivered = runs.reduce((sum, run) => sum + run.confirmedSeats, 0);
        const completed = runs.filter((run) => completedRunStatuses.includes(run.status)).length;
        const ratings = runs.flatMap((run) => run.trainingEvaluations);
        const revenue = item.courses.reduce((sum, course) => {
          const price = decimalToNumber(course.pricingRecords[0]?.finalUnitPriceWithoutTax);
          return sum + price * course.runs.reduce((seatSum, run) => seatSum + run.confirmedSeats, 0);
        }, 0);
        const vendorCost = runs.reduce((sum, run) => sum + decimalToNumber(run.vendorCost), 0);
        return [
          item.nameEn || item.nameAr,
          `${completed} / ${runs.length}`,
          delivered,
          formatPercent(ratio(delivered, plannedSeats), locale),
          formatNumber(average(ratings.filter((rating) => rating.evaluationType === TrainingEvaluationType.COURSE).map((rating) => rating.rating)), locale),
          formatNumber(average(ratings.filter((rating) => rating.evaluationType === TrainingEvaluationType.INSTRUCTOR).map((rating) => rating.rating)), locale),
          formatPercent(packageAttendance.get(item.id) ?? 0, locale),
          formatCurrency(revenue, locale),
          formatCurrency(vendorCost, locale),
          formatPercent(ratio(revenue - vendorCost, revenue), locale),
        ];
      }),
    ],
    [28, 24, 18, 18, 18, 22, 18, 18, 18, 18],
    rtl,
  );

  addWorksheet(
    workbook,
    labels.projectScopes.summaryTitle,
    [
      [
        labels.projectScopes.scope,
        labels.dashboardOverview.courseName,
        labels.dashboardOverview.package,
        labels.projectScopes.estimatedSeats,
        labels.projectScopes.actualSeats,
        labels.projectScopes.remainingSeats,
        labels.projectScopes.fulfillmentPct,
        labels.projectScopes.linkedTrainings,
        labels.projectScopes.statusFlag,
      ],
      ...projectScopes.flatMap((scope) =>
        scope.selectedCourses.map((entry) => {
          const actual = entry.courseRuns.reduce((sum, run) => sum + run.confirmedSeats, 0);
          const estimated = entry.estimatedSeats ?? 0;
          return [
            scope.nameEn || scope.nameAr || scope.name,
            entry.course.nameEn || entry.course.nameAr,
            entry.course.package.nameEn || entry.course.package.nameAr || entry.course.package.code,
            estimated,
            actual,
            estimated - actual,
            formatPercent(ratio(actual, estimated), locale),
            entry.courseRuns.length,
            actual > estimated
              ? labels.projectScopes.overageFlag
              : actual < estimated
                ? labels.projectScopes.shortfallFlag
                : "-",
          ];
        }),
      ),
    ],
    [28, 34, 24, 16, 16, 16, 16, 18, 20],
    rtl,
  );

  const courseAttendance = new Map(
    await Promise.all(
      courses.map(async (course) => [course.id, (await getCourseSessionAttendanceRate(course.id)).attendanceRate] as const),
    ),
  );
  addWorksheet(
    workbook,
    labels.dashboardOverview.coursePerformance,
    [
      [
        labels.dashboardOverview.courseName,
        labels.dashboardOverview.package,
        labels.dashboardOverview.totalTrainings,
        labels.dashboardOverview.seatsPlanned,
        labels.dashboardOverview.seatsDelivered,
        labels.dashboardOverview.utilization,
        labels.dashboardOverview.averageCourseRating,
        labels.dashboardOverview.averageInstructorRating,
        labels.dashboardOverview.attendanceRate,
      ],
      ...courses.map((course) => {
        const planned = course.scopeSelections.reduce((sum, item) => sum + (item.estimatedSeats ?? 0), 0);
        const delivered = course.runs.reduce((sum, run) => sum + run.confirmedSeats, 0);
        const ratings = course.runs.flatMap((run) => run.trainingEvaluations);
        return [
          course.nameEn || course.nameAr,
          course.package.nameEn || course.package.nameAr || course.package.code,
          course.runs.length,
          planned,
          delivered,
          formatPercent(ratio(delivered, planned), locale),
          formatNumber(average(ratings.filter((rating) => rating.evaluationType === TrainingEvaluationType.COURSE).map((rating) => rating.rating)), locale),
          formatNumber(average(ratings.filter((rating) => rating.evaluationType === TrainingEvaluationType.INSTRUCTOR).map((rating) => rating.rating)), locale),
          formatPercent(courseAttendance.get(course.id) ?? 0, locale),
        ];
      }),
    ],
    [38, 24, 16, 16, 16, 16, 18, 22, 18],
    rtl,
  );

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;
}
