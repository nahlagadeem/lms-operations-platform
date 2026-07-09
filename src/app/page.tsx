import Link from "next/link";
import {
  CourseRunStatus,
  DocumentEntityType,
  Prisma,
  TrainingEvaluationType,
} from "@prisma/client";
import { InstantSearchField } from "@/components/instant-search-field";
import { db } from "@/lib/db";
import { getLocale, t } from "@/lib/locale";
import { canViewFinancials, getCurrentPlatformRole } from "@/lib/permissions";
import { formatPurchaseOrderCode, formatPurchaseOrderTitle } from "@/lib/purchase-order";
import { getProjectSummary } from "@/server/services/project-overview-service";
import {
  formatReportingDate,
  getProjectReportingRows,
  getReportingCategoryOptions,
} from "@/server/services/project-reporting-service";
import {
  getCourseSessionAttendanceRate,
  getPackageSessionAttendanceRate,
  getProjectSessionAttendanceRate,
} from "@/server/services/capacity-service";
import { getOverallPoFulfillment } from "@/server/services/purchase-order-service";
import { getProjectFinancialOverview } from "@/server/services/training-financial-service";
import { getProjectQualityOverview } from "@/server/services/training-evaluation-service";

type HomePageProps = {
  searchParams?: Promise<{
    q?: string;
    category?: string;
    page?: string;
    packagePage?: string;
    coursePage?: string;
    poPage?: string;
    courseQ?: string;
    poQ?: string;
  }>;
};

const DASHBOARD_TABLE_PAGE_SIZE = 10;
const SHOW_DASHBOARD_COURSE_PERFORMANCE = false;
const SHOW_DASHBOARD_REPORTING = false;

const plannedRunStatuses: CourseRunStatus[] = [
  CourseRunStatus.DRAFT,
  CourseRunStatus.PLANNED,
  CourseRunStatus.APPROVAL_PENDING,
  CourseRunStatus.OPEN_FOR_NOMINATION,
  CourseRunStatus.CONFIRMED,
];

const liveRunStatuses: CourseRunStatus[] = [
  CourseRunStatus.PLANNED,
  CourseRunStatus.APPROVAL_PENDING,
  CourseRunStatus.OPEN_FOR_NOMINATION,
  CourseRunStatus.CONFIRMED,
  CourseRunStatus.ONGOING,
];

const completedRunStatuses: CourseRunStatus[] = [
  CourseRunStatus.COMPLETED,
  CourseRunStatus.CLOSED,
];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalize(value?: string) {
  return value?.trim() || "";
}

function normalizePage(value?: string) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatPercent(value: number, locale: string) {
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: Date | null, locale: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

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

function formatRating(value: number | null, locale: string) {
  return value === null
    ? "-"
    : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

function buildDashboardUrl(params: {
  q?: string;
  category?: string;
  page?: number;
  packagePage?: number;
  coursePage?: number;
  poPage?: number;
  courseQ?: string;
  poQ?: string;
}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  if (params.packagePage && params.packagePage > 1) search.set("packagePage", String(params.packagePage));
  if (params.coursePage && params.coursePage > 1) search.set("coursePage", String(params.coursePage));
  if (params.poPage && params.poPage > 1) search.set("poPage", String(params.poPage));
  if (params.courseQ) search.set("courseQ", params.courseQ);
  if (params.poQ) search.set("poQ", params.poQ);
  const query = search.toString();
  return query ? `/?${query}` : "/";
}

function paginationPages(current: number, total: number) {
  const pages = new Set([1, total, current, current - 1, current + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b)
    .reduce<Array<number | "ellipsis">>((items, page) => {
      const previous = items.at(-1);
      if (typeof previous === "number" && page - previous > 1) {
        items.push("ellipsis");
      }
      items.push(page);
      return items;
    }, []);
}

export const revalidate = 0;

export default async function HomePage({ searchParams }: HomePageProps) {
  const locale = await getLocale();
  const localeText = t(locale);
  const dashboardText = localeText.dashboardOverview;
  const homeUiText =
    locale === "ar"
      ? {
          refresh: "تحديث",
          totalProjectValue: "إجمالي قيمة المشروع",
          totalInvoiced: "إجمالي المفوتر",
          totalCollected: "إجمالي المحصل",
          remainingUnbilled: "المتبقي غير المفوتر",
          trainings: "التدريبات",
          attendees: "المتدربون",
          seatUtilization: "استخدام المقاعد",
          attendanceRate: "نسبة الحضور",
          satisfactionRate: "نسبة الرضا",
          activeInstructors: "المدربون النشطون",
          completedOngoingPlanned: "{completed} مكتمل / {ongoing} جاري / {planned} مخطط",
          completedOngoingUpcoming: "{completed} مكتمل / {ongoing} جاري / {upcoming} قادم",
          activeNow: "{active} نشط حاليا",
          actualEstimatedSeats: "{actual} فعلي / {estimated} مقدر",
          attendedPossibleSlots: "{attended} حضور / {possible} جلسة ممكنة",
          feedbackEntries: "{count} إدخال تقييم",
          approvedInstructorsLive: "مدربون معتمدون معينون على أعمال نشطة",
          trainingsRunningToday: "تدريبات جارية اليوم",
          upcomingNextSevenDays: "القادم خلال 7 أيام",
          completedLastSevenDays: "المكتمل خلال آخر 7 أيام",
          progressOfTotal: "{completed} من {total}",
          noItems: "لا توجد عناصر.",
        }
      : {
          refresh: "Refresh",
          totalProjectValue: "Total Project Value",
          totalInvoiced: "Total Invoiced",
          totalCollected: "Total Collected",
          remainingUnbilled: "Remaining Unbilled",
          trainings: "Trainings",
          attendees: "Attendees",
          seatUtilization: "Seat utilization",
          attendanceRate: "Attendance rate",
          satisfactionRate: "Satisfaction rate",
          activeInstructors: "Active instructors",
          completedOngoingPlanned: "{completed} completed / {ongoing} ongoing / {planned} planned",
          completedOngoingUpcoming: "{completed} completed / {ongoing} ongoing / {upcoming} upcoming",
          activeNow: "{active} active right now",
          actualEstimatedSeats: "{actual} actual / {estimated} estimated seats",
          attendedPossibleSlots: "{attended} attended / {possible} possible session slots",
          feedbackEntries: "{count} feedback entries",
          approvedInstructorsLive: "Approved instructors assigned to live work",
          trainingsRunningToday: "Trainings running today",
          upcomingNextSevenDays: "Upcoming in next 7 days",
          completedLastSevenDays: "Completed in last 7 days",
          progressOfTotal: "{completed} of {total}",
          noItems: "No items found.",
        };
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";
  const params = (await searchParams) ?? {};
  const platformRole = await getCurrentPlatformRole();
  const canSeeFinancials = canViewFinancials(platformRole);
  const searchTerm = normalize(params.q);
  const categoryFilter = normalize(params.category);
  const reportingPage = normalizePage(params.page);
  const packagePage = normalizePage(params.packagePage);
  const coursePage = normalizePage(params.coursePage);
  const poPage = normalizePage(params.poPage);
  const courseSearch = normalize(params.courseQ).toLowerCase();
  const poSearch = normalize(params.poQ).toLowerCase();

  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const nextSevenDays = addDays(todayStart, 7);
  const lastSevenDays = addDays(todayStart, -7);

  const [
    totalCourses,
    completedCourseIds,
    ongoingCourseIds,
    plannedCourseIds,
    participantCounts,
    runGroups,
    seatRows,
    projectAttendanceSummary,
    evaluationRows,
    qualitySatisfactionRows,
    activeTrainerCount,
    scopeRows,
    monthlyRuns,
    todayRuns,
    upcomingRuns,
    recentlyCompletedRuns,
    reportingRows,
    projectSummary,
    poFulfillment,
    projectFinancialOverview,
    projectQualityOverview,
    dashboardPackages,
    dashboardCourses,
    projectScopeRows,
    scopeDocumentCounts,
  ] = await Promise.all([
    db.course.count(),
    db.courseRun.findMany({
      where: { status: { in: [CourseRunStatus.COMPLETED, CourseRunStatus.CLOSED] } },
      distinct: ["courseId"],
      select: { courseId: true },
    }),
    db.courseRun.findMany({
      where: { status: CourseRunStatus.ONGOING },
      distinct: ["courseId"],
      select: { courseId: true },
    }),
    db.courseRun.findMany({
      where: { status: { in: plannedRunStatuses } },
      distinct: ["courseId"],
      select: { courseId: true },
    }),
    db.participant.groupBy({
      by: ["isActive"],
      _count: { _all: true },
    }),
    db.courseRun.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.courseRun.findMany({
      select: { plannedSeats: true, confirmedSeats: true },
    }),
    getProjectSessionAttendanceRate(),
    db.evaluation.findMany({
      select: { overallScore: true },
      where: { overallScore: { not: null } },
    }),
    db.qualityReport.findMany({
      select: { satisfactionRate: true },
      where: { satisfactionRate: { not: null } },
    }),
    db.trainer.count({
      where: {
        isApproved: true,
        courseAssignments: {
          some: {
            courseRun: {
              status: { in: liveRunStatuses },
            },
          },
        },
      },
    }),
    db.projectScope.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        plannedCompletion: true,
        actualCompletion: true,
        selectedCourses: {
          select: {
            courseId: true,
            course: {
              select: {
                runs: {
                  select: {
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { code: "asc" },
    }),
    db.courseRun.findMany({
      select: { startDate: true },
      where: { startDate: { not: null } },
      orderBy: { startDate: "asc" },
    }),
    db.courseRun.findMany({
      where: {
        startDate: { lt: tomorrowStart },
        endDate: { gte: todayStart },
        status: { in: [CourseRunStatus.CONFIRMED, CourseRunStatus.ONGOING] },
      },
      include: {
        course: { select: { nameAr: true, nameEn: true } },
        location: { select: { nameAr: true, nameEn: true, city: true } },
        trainers: {
          where: { isPrimary: true },
          include: { trainer: { select: { fullNameAr: true, fullNameEn: true } } },
          take: 1,
        },
      },
      orderBy: { startDate: "asc" },
      take: 8,
    }),
    db.courseRun.findMany({
      where: {
        startDate: { gte: todayStart, lt: nextSevenDays },
        status: { in: plannedRunStatuses },
      },
      include: {
        course: { select: { nameAr: true, nameEn: true } },
        location: { select: { nameAr: true, nameEn: true, city: true } },
        trainers: {
          where: { isPrimary: true },
          include: { trainer: { select: { fullNameAr: true, fullNameEn: true } } },
          take: 1,
        },
      },
      orderBy: { startDate: "asc" },
      take: 8,
    }),
    db.courseRun.findMany({
      where: {
        endDate: { gte: lastSevenDays, lt: tomorrowStart },
        status: { in: [CourseRunStatus.COMPLETED, CourseRunStatus.CLOSED] },
      },
      include: {
        course: { select: { nameAr: true, nameEn: true } },
        location: { select: { nameAr: true, nameEn: true, city: true } },
      },
      orderBy: { endDate: "desc" },
      take: 8,
    }),
    SHOW_DASHBOARD_REPORTING && canSeeFinancials
      ? getProjectReportingRows(locale, {
          q: searchTerm,
          category: categoryFilter,
        })
      : Promise.resolve([]),
    getProjectSummary(),
    getOverallPoFulfillment(),
    canSeeFinancials ? getProjectFinancialOverview() : Promise.resolve(null),
    getProjectQualityOverview(),
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
            scopeSelections: {
              select: { estimatedSeats: true },
            },
          },
        },
      },
    }),
    SHOW_DASHBOARD_COURSE_PERFORMANCE
      ? db.course.findMany({
          orderBy: [{ package: { code: "asc" } }, { courseCode: "asc" }],
          include: {
            package: {
              select: { id: true, code: true, nameAr: true, nameEn: true },
            },
            runs: {
              include: {
                trainingEvaluations: {
                  select: { evaluationType: true, rating: true },
                },
              },
            },
            scopeSelections: {
              select: { estimatedSeats: true },
            },
          },
        })
      : Promise.resolve([]),
    db.projectScope.findMany({
      include: {
        selectedCourses: {
          include: {
            courseRuns: {
              select: {
                id: true,
                confirmedSeats: true,
              },
            },
            course: {
              select: {
                id: true,
                courseCode: true,
                nameAr: true,
                nameEn: true,
                package: {
                  select: {
                    code: true,
                    nameAr: true,
                    nameEn: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { code: "asc" },
    }),
    db.document.groupBy({
      by: ["entityId"],
      where: { entityType: DocumentEntityType.SCOPE },
      _count: { _all: true },
    }),
  ]);

  const allTimeTrainees = participantCounts.reduce(
    (sum, item) => sum + item._count._all,
    0,
  );
  const activeTrainees = participantCounts.find((item) => item.isActive)?._count._all ?? 0;
  const runCount = (status: CourseRunStatus) =>
    runGroups.find((item) => item.status === status)?._count._all ?? 0;
  const totalRuns = runGroups.reduce((sum, item) => sum + item._count._all, 0);
  const completedRuns =
    runCount(CourseRunStatus.COMPLETED) + runCount(CourseRunStatus.CLOSED);
  const ongoingRuns = runCount(CourseRunStatus.ONGOING);
  const upcomingRunsCount = runGroups
    .filter((item) => plannedRunStatuses.includes(item.status))
    .reduce((sum, item) => sum + item._count._all, 0);
  const allocatedSeats = seatRows.reduce((sum, item) => sum + (item.plannedSeats ?? 0), 0);
  const filledSeats = seatRows.reduce((sum, item) => sum + item.confirmedSeats, 0);
  const seatUtilization = ratio(filledSeats, allocatedSeats);
  const evaluationSatisfaction =
    evaluationRows.length > 0
      ? evaluationRows.reduce((sum, item) => sum + decimalToNumber(item.overallScore) * 20, 0) /
        evaluationRows.length
      : 0;
  const qualitySatisfaction =
    qualitySatisfactionRows.length > 0
      ? qualitySatisfactionRows.reduce((sum, item) => sum + decimalToNumber(item.satisfactionRate), 0) /
        qualitySatisfactionRows.length
      : 0;
  const satisfactionRate =
    qualitySatisfactionRows.length > 0 ? qualitySatisfaction : evaluationSatisfaction;

  const scopeProgress = scopeRows.map((scope) => {
    const total = scope.selectedCourses.length;
    const completed = scope.selectedCourses.filter((selection) =>
      selection.course.runs.some((run) => completedRunStatuses.includes(run.status)),
    ).length;
    const ongoing = scope.selectedCourses.filter((selection) =>
      selection.course.runs.some((run) => run.status === CourseRunStatus.ONGOING),
    ).length;
    return {
      code: scope.code,
      name: formatPurchaseOrderTitle(scope, locale),
      completed,
      ongoing,
      total,
      percent: ratio(completed, total),
    };
  });

  const monthlyActivity = monthlyRuns.reduce<Record<string, number>>((groups, run) => {
    if (!run.startDate) return groups;
    const key = `${run.startDate.getFullYear()}-${String(run.startDate.getMonth() + 1).padStart(2, "0")}`;
    groups[key] = (groups[key] ?? 0) + 1;
    return groups;
  }, {});
  const monthlyChart = Object.entries(monthlyActivity)
    .slice(-8)
    .map(([month, count]) => ({ label: month, value: count }));

  const reportExportUrl = `/api/dashboard-report?${new URLSearchParams({
    ...(searchTerm ? { q: searchTerm } : {}),
    ...(categoryFilter ? { category: categoryFilter } : {}),
  }).toString()}`;
  const homeExportUrl = "/api/dashboard-report?type=home";
  const categoryOptions = getReportingCategoryOptions(locale);
  const totalReportingPages = Math.max(
    1,
    Math.ceil(reportingRows.length / DASHBOARD_TABLE_PAGE_SIZE),
  );
  const safeReportingPage = Math.min(reportingPage, totalReportingPages);
  const visibleReportingRows = reportingRows.slice(
    (safeReportingPage - 1) * DASHBOARD_TABLE_PAGE_SIZE,
    safeReportingPage * DASHBOARD_TABLE_PAGE_SIZE,
  );
  const scopeDocumentCountById = new Map(
    scopeDocumentCounts.map((item) => [item.entityId, item._count._all]),
  );
  const projectScopeSummaryRows = projectScopeRows.flatMap((scope) =>
    scope.selectedCourses.map((selection) => {
      const estimatedSeats = selection.estimatedSeats ?? 0;
      const actualSeats = selection.courseRuns.reduce(
        (sum, run) => sum + run.confirmedSeats,
        0,
      );
      const remainingSeats = estimatedSeats - actualSeats;
      const statusFlag =
        actualSeats > estimatedSeats
          ? localeText.projectScopes.overageFlag
          : actualSeats < estimatedSeats
            ? localeText.projectScopes.shortfallFlag
            : "-";

      return {
        id: selection.id,
        scopeId: scope.id,
      code: formatPurchaseOrderCode(scope.code, locale),
      name: formatPurchaseOrderTitle(scope, locale),
        courseId: selection.course.id,
        courseName: selection.course.nameEn || selection.course.nameAr,
        packageName:
          selection.course.package.nameEn ||
          selection.course.package.nameAr ||
          selection.course.package.code,
        estimatedSeats,
        actualSeats,
        remainingSeats,
        fulfillmentPct: ratio(actualSeats, estimatedSeats),
        linkedTrainings: selection.courseRuns.length,
        statusFlag,
        documents: scopeDocumentCountById.get(scope.id) ?? 0,
      };
    }),
  );
  const filteredProjectScopeSummaryRows = projectScopeSummaryRows.filter((row) => {
    if (!poSearch) return true;
    return [row.code, row.name, row.courseName, row.packageName, row.statusFlag]
      .join(" ")
      .toLowerCase()
      .includes(poSearch);
  });
  const totalPoPages = Math.max(
    1,
    Math.ceil(filteredProjectScopeSummaryRows.length / DASHBOARD_TABLE_PAGE_SIZE),
  );
  const safePoPage = Math.min(poPage, totalPoPages);
  const visibleProjectScopeSummaryRows = filteredProjectScopeSummaryRows.slice(
    (safePoPage - 1) * DASHBOARD_TABLE_PAGE_SIZE,
    safePoPage * DASHBOARD_TABLE_PAGE_SIZE,
  );

  const completedTrainingCount = completedRuns;
  const plannedTrainingCount = totalRuns;
  const deliveredSeats = filledSeats;
  const committedSeats = allocatedSeats;
  const courseAttendanceRates = SHOW_DASHBOARD_COURSE_PERFORMANCE
    ? await Promise.all(
        dashboardCourses.map(async (course) => ({
          courseId: course.id,
          attendanceRate: (await getCourseSessionAttendanceRate(course.id)).attendanceRate,
        })),
      )
    : [];
  const packageAttendanceRates = await Promise.all(
    dashboardPackages.map(async (item) => ({
      packageId: item.id,
      attendanceRate: (await getPackageSessionAttendanceRate(item.id)).attendanceRate,
    })),
  );
  const courseAttendanceById = new Map(
    courseAttendanceRates.map((item) => [item.courseId, item.attendanceRate]),
  );
  const packageAttendanceById = new Map(
    packageAttendanceRates.map((item) => [item.packageId, item.attendanceRate]),
  );
  const packageBreakdownRows = dashboardPackages.map((item) => {
    const runs = item.courses.flatMap((course) => course.runs);
    const plannedSeats = item.courses.reduce(
      (sum, course) =>
        sum +
        course.scopeSelections.reduce(
          (courseSum, selection) => courseSum + (selection.estimatedSeats ?? 0),
          0,
        ),
      0,
    );
    const delivered = runs.reduce((sum, run) => sum + run.confirmedSeats, 0);
    const completed = runs.filter((run) => completedRunStatuses.includes(run.status)).length;
    const courseRatings = runs.flatMap((run) =>
      run.trainingEvaluations
        .filter((evaluation) => evaluation.evaluationType === TrainingEvaluationType.COURSE)
        .map((evaluation) => evaluation.rating),
    );
    const instructorRatings = runs.flatMap((run) =>
      run.trainingEvaluations
        .filter((evaluation) => evaluation.evaluationType === TrainingEvaluationType.INSTRUCTOR)
        .map((evaluation) => evaluation.rating),
    );
    const revenue = item.courses.reduce((sum, course) => {
      const price = decimalToNumber(course.pricingRecords[0]?.finalUnitPriceWithoutTax);
      const courseSeats = course.runs.reduce((seatSum, run) => seatSum + run.confirmedSeats, 0);
      return sum + price * courseSeats;
    }, 0);
    const vendorCost = runs.reduce((sum, run) => sum + decimalToNumber(run.vendorCost), 0);

    return {
      id: item.id,
      code: item.code,
      name: item.nameEn || item.nameAr,
      completed,
      planned: runs.length,
      delivered,
      utilization: ratio(delivered, plannedSeats),
      averageCourseRating: average(courseRatings),
      averageInstructorRating: average(instructorRatings),
      attendanceRate: packageAttendanceById.get(item.id) ?? 0,
      revenue,
      vendorCost,
      marginPct: ratio(revenue - vendorCost, revenue),
    };
  });
  const totalPackagePages = Math.max(
    1,
    Math.ceil(packageBreakdownRows.length / DASHBOARD_TABLE_PAGE_SIZE),
  );
  const safePackagePage = Math.min(packagePage, totalPackagePages);
  const visiblePackageBreakdownRows = packageBreakdownRows.slice(
    (safePackagePage - 1) * DASHBOARD_TABLE_PAGE_SIZE,
    safePackagePage * DASHBOARD_TABLE_PAGE_SIZE,
  );
  const courseSummaryRows = dashboardCourses.map((course) => {
    const plannedSeats = course.scopeSelections.reduce(
      (sum, selection) => sum + (selection.estimatedSeats ?? 0),
      0,
    );
    const delivered = course.runs.reduce((sum, run) => sum + run.confirmedSeats, 0);
    const courseRatings = course.runs.flatMap((run) =>
      run.trainingEvaluations
        .filter((evaluation) => evaluation.evaluationType === TrainingEvaluationType.COURSE)
        .map((evaluation) => evaluation.rating),
    );
    const instructorRatings = course.runs.flatMap((run) =>
      run.trainingEvaluations
        .filter((evaluation) => evaluation.evaluationType === TrainingEvaluationType.INSTRUCTOR)
        .map((evaluation) => evaluation.rating),
    );

    return {
      id: course.id,
      name: course.nameEn || course.nameAr,
      packageName: course.package.nameEn || course.package.nameAr || course.package.code,
      totalTrainings: course.runs.length,
      plannedSeats,
      delivered,
      utilization: ratio(delivered, plannedSeats),
      averageCourseRating: average(courseRatings),
      averageInstructorRating: average(instructorRatings),
      attendanceRate: courseAttendanceById.get(course.id) ?? 0,
    };
  });
  const filteredCourseSummaryRows = courseSummaryRows.filter((row) => {
    if (!courseSearch) return true;
    return [row.name, row.packageName].join(" ").toLowerCase().includes(courseSearch);
  });
  const totalCoursePages = Math.max(
    1,
    Math.ceil(filteredCourseSummaryRows.length / DASHBOARD_TABLE_PAGE_SIZE),
  );
  const safeCoursePage = Math.min(coursePage, totalCoursePages);
  const visibleCourseSummaryRows = filteredCourseSummaryRows.slice(
    (safeCoursePage - 1) * DASHBOARD_TABLE_PAGE_SIZE,
    safeCoursePage * DASHBOARD_TABLE_PAGE_SIZE,
  );

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">{localeText.home.dashboardEyebrow}</p>
          <h1 className="section-title">{localeText.home.projectIndicatorsTitle}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSeeFinancials ? (
            <a href={homeExportUrl} className="primary-button">
              {localeText.buttons.exportExcel}
            </a>
          ) : null}
          <Link href={buildDashboardUrl({})} className="primary-button">
            {homeUiText.refresh}
          </Link>
        </div>
      </section>

      {canSeeFinancials && projectFinancialOverview ? (
        <section className="panel-surface">
          <div className="mb-5">
            <p className="eyebrow">{dashboardText.financialEyebrow}</p>
            <h2 className="section-title">{dashboardText.financialTitle}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReadOnlySummaryCard
              label={dashboardText.totalRevenueRecognized}
              value={formatCurrency(decimalToNumber(projectFinancialOverview.totals.revenue), numberLocale)}
            />
            <ReadOnlySummaryCard
              label={dashboardText.totalVendorCost}
              value={formatCurrency(decimalToNumber(projectFinancialOverview.totals.vendorCost), numberLocale)}
            />
            <ReadOnlySummaryCard
              label={dashboardText.overallGrossMargin}
              value={formatPercent(projectFinancialOverview.totals.marginPct, numberLocale)}
            />
            <ReadOnlySummaryCard
              label={homeUiText.totalProjectValue}
              value={formatCurrency(decimalToNumber(projectSummary.totalProjectValue), numberLocale)}
            />
            <ReadOnlySummaryCard
              label={homeUiText.totalInvoiced}
              value={formatCurrency(decimalToNumber(projectSummary.totalProjectInvoices), numberLocale)}
            />
            <ReadOnlySummaryCard
              label={homeUiText.totalCollected}
              value={formatCurrency(decimalToNumber(projectSummary.totalCollectedValue), numberLocale)}
            />
            <ReadOnlySummaryCard
              label={homeUiText.remainingUnbilled}
              value={formatCurrency(decimalToNumber(projectSummary.remainingUnbilledValue), numberLocale)}
            />
          </div>
        </section>
      ) : null}

      <section className="panel-surface">
        <div className="mb-5">
          <p className="eyebrow">{dashboardText.deliveryEyebrow}</p>
          <h2 className="section-title">{dashboardText.deliveryTitle}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReadOnlySummaryCard
            label={dashboardText.trainingsPlannedCompleted}
            value={`${formatNumber(plannedTrainingCount, numberLocale)} / ${formatNumber(completedTrainingCount, numberLocale)}`}
          />
          <ReadOnlySummaryCard
            label={dashboardText.seatsCommittedDelivered}
            value={`${formatNumber(committedSeats, numberLocale)} / ${formatNumber(deliveredSeats, numberLocale)}`}
          />
          <ReadOnlySummaryCard
            label={dashboardText.overallPoFulfillment}
            value={formatPercent(poFulfillment.fulfillmentPct, numberLocale)}
          />
          <ReadOnlySummaryCard
            label={dashboardText.projectStartDate}
            value={formatDate(projectSummary.startDate, numberLocale)}
          />
          <ReadOnlySummaryCard
            label={dashboardText.expectedEndDate}
            value={formatDate(projectSummary.expectedEndDate, numberLocale)}
          />
          <ReadOnlySummaryCard
            label={dashboardText.baselineProgress}
            value={formatPercent(decimalToNumber(projectSummary.baselineProgress), numberLocale)}
          />
          <ReadOnlySummaryCard
            label={dashboardText.actualProgress}
            value={formatPercent(decimalToNumber(projectSummary.actualProgress), numberLocale)}
          />
        </div>
      </section>

      <section className="panel-surface">
        <div className="mb-5">
          <p className="eyebrow">{dashboardText.qualityEyebrow}</p>
          <h2 className="section-title">{dashboardText.qualityTitle}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <ReadOnlySummaryCard
            label={dashboardText.averageCourseRatingProject}
            value={formatRating(projectQualityOverview.averageCourseRating, numberLocale)}
          />
          <ReadOnlySummaryCard
            label={dashboardText.averageInstructorRatingProject}
            value={formatRating(projectQualityOverview.averageInstructorRating, numberLocale)}
          />
          <ReadOnlySummaryCard
            label={dashboardText.overallAttendanceRate}
            value={formatPercent(projectAttendanceSummary.attendanceRate, numberLocale)}
          />
        </div>
      </section>

      <section className="panel-surface">
        <div className="mb-5">
          <p className="eyebrow">{dashboardText.packagesEyebrow}</p>
          <h2 className="section-title">{dashboardText.packagePerformance}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{dashboardText.package}</th>
                <th>{dashboardText.trainingsCompletedPlanned}</th>
                <th>{dashboardText.totalSeatsDelivered}</th>
                <th>{dashboardText.seatUtilization}</th>
                <th>{dashboardText.averageCourseRating}</th>
                <th>{dashboardText.averageInstructorRating}</th>
                <th>{dashboardText.attendanceRate}</th>
                {canSeeFinancials ? (
                  <>
                    <th>{dashboardText.revenueByPackage}</th>
                    <th>{dashboardText.vendorCostByPackage}</th>
                    <th>{dashboardText.grossMarginByPackage}</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {visiblePackageBreakdownRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <p className="latin-chip">{row.code}</p>
                    <p className="mt-1 font-semibold text-[var(--ink-strong)]">{row.name}</p>
                  </td>
                  <td>{formatNumber(row.completed, numberLocale)} / {formatNumber(row.planned, numberLocale)}</td>
                  <td>{formatNumber(row.delivered, numberLocale)}</td>
                  <td>{formatPercent(row.utilization, numberLocale)}</td>
                  <td>{formatRating(row.averageCourseRating, numberLocale)}</td>
                  <td>{formatRating(row.averageInstructorRating, numberLocale)}</td>
                  <td>{formatPercent(row.attendanceRate, numberLocale)}</td>
                  {canSeeFinancials ? (
                    <>
                      <td>{formatCurrency(row.revenue, numberLocale)}</td>
                      <td>{formatCurrency(row.vendorCost, numberLocale)}</td>
                      <td>{formatPercent(row.marginPct, numberLocale)}</td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DashboardPagination
          currentPage={safePackagePage}
          totalPages={totalPackagePages}
          numberLocale={numberLocale}
          labels={localeText.pagination}
          hrefForPage={(page) =>
            buildDashboardUrl({
              q: searchTerm,
              category: categoryFilter,
              page: safeReportingPage,
              packagePage: page,
              coursePage: safeCoursePage,
              poPage: safePoPage,
              courseQ: params.courseQ ?? "",
              poQ: params.poQ ?? "",
            })
          }
        />
      </section>

      {/* Hidden for now by request. Restore by setting SHOW_DASHBOARD_COURSE_PERFORMANCE to true. */}
      {SHOW_DASHBOARD_COURSE_PERFORMANCE && platformRole !== "CUSTOMER" ? (
        <section className="panel-surface">
          <div className="mb-5">
            <p className="eyebrow">{dashboardText.coursesEyebrow}</p>
            <h2 className="section-title">{dashboardText.coursePerformance}</h2>
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <InstantSearchField
              name="courseQ"
              label={localeText.common.search}
              defaultValue={params.courseQ ?? ""}
              placeholder={localeText.common.searchPlaceholder}
              pageParams={["coursePage"]}
            />
            <Link
              href={buildDashboardUrl({
                q: searchTerm,
                category: categoryFilter,
                page: safeReportingPage,
                packagePage: safePackagePage,
                poPage: safePoPage,
                poQ: params.poQ ?? "",
              })}
              className="secondary-button self-end"
            >
              {localeText.common.reset}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{dashboardText.courseName}</th>
                  <th>{dashboardText.package}</th>
                  <th>{dashboardText.totalTrainings}</th>
                  <th>{dashboardText.seatsPlanned}</th>
                  <th>{dashboardText.seatsDelivered}</th>
                  <th>{dashboardText.utilization}</th>
                </tr>
              </thead>
              <tbody>
                {visibleCourseSummaryRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/courses/${row.id}`} className="font-semibold text-[var(--brand-ink)] hover:underline">
                        {row.name}
                      </Link>
                    </td>
                    <td>{row.packageName}</td>
                    <td>{formatNumber(row.totalTrainings, numberLocale)}</td>
                    <td>{formatNumber(row.plannedSeats, numberLocale)}</td>
                    <td>{formatNumber(row.delivered, numberLocale)}</td>
                    <td>{formatPercent(row.utilization, numberLocale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCourseSummaryRows.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--ink-soft)]">{localeText.common.noResults}</p>
            ) : null}
          </div>
          <DashboardPagination
            currentPage={safeCoursePage}
            totalPages={totalCoursePages}
            numberLocale={numberLocale}
            labels={localeText.pagination}
            hrefForPage={(page) =>
              buildDashboardUrl({
                q: searchTerm,
                category: categoryFilter,
                page: safeReportingPage,
                packagePage: safePackagePage,
                coursePage: page,
                poPage: safePoPage,
                courseQ: params.courseQ ?? "",
                poQ: params.poQ ?? "",
              })
            }
          />
        </section>
      ) : null}

      {platformRole !== "CUSTOMER" ? (
      <section className="panel-surface">
        <div className="mb-5">
          <p className="eyebrow">{localeText.projectScopes.summaryTitle}</p>
          <h2 className="section-title">{localeText.projectScopes.summaryTitle}</h2>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <InstantSearchField
            name="poQ"
            label={localeText.common.search}
            defaultValue={params.poQ ?? ""}
            placeholder={localeText.common.searchPlaceholder}
            pageParams={["poPage"]}
          />
          <Link
            href={buildDashboardUrl({
              q: searchTerm,
              category: categoryFilter,
              page: safeReportingPage,
              packagePage: safePackagePage,
              coursePage: safeCoursePage,
              courseQ: params.courseQ ?? "",
            })}
            className="secondary-button self-end"
          >
            {localeText.common.reset}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{localeText.projectScopes.scope}</th>
                <th>{dashboardText.courseName}</th>
                <th>{dashboardText.package}</th>
                <th>{localeText.projectScopes.estimatedSeats}</th>
                <th>{localeText.projectScopes.actualSeats}</th>
                <th>{localeText.projectScopes.remainingSeats}</th>
                <th>{localeText.projectScopes.fulfillmentPct}</th>
                <th>{localeText.projectScopes.linkedTrainings}</th>
                <th>{localeText.projectScopes.statusFlag}</th>
                <th>{localeText.projectScopes.viewDetails}</th>
              </tr>
            </thead>
            <tbody>
              {visibleProjectScopeSummaryRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="space-y-1">
                      <p className="latin-chip">{row.code}</p>
                      <p className="font-semibold text-[var(--ink-strong)]">{row.name}</p>
                    </div>
                  </td>
                  <td>
                    <Link href={`/courses/${row.courseId}`} className="font-semibold text-[var(--brand-ink)] hover:underline">
                      {row.courseName}
                    </Link>
                  </td>
                  <td>{row.packageName}</td>
                  <td>{formatNumber(row.estimatedSeats, numberLocale)}</td>
                  <td>{formatNumber(row.actualSeats, numberLocale)}</td>
                  <td>{formatNumber(row.remainingSeats, numberLocale)}</td>
                  <td>{formatPercent(row.fulfillmentPct, numberLocale)}</td>
                  <td>{formatNumber(row.linkedTrainings, numberLocale)}</td>
                  <td><span className="status-pill">{row.statusFlag}</span></td>
                  <td>
                    <Link href={`/pos/${row.scopeId}`} className="secondary-button">
                      {localeText.projectScopes.viewDetails}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {projectScopeSummaryRows.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--ink-soft)]">
              {localeText.projectScopes.noScopes}
            </p>
          ) : null}
          {projectScopeSummaryRows.length > 0 && filteredProjectScopeSummaryRows.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--ink-soft)]">{localeText.common.noResults}</p>
          ) : null}
        </div>
        <DashboardPagination
          currentPage={safePoPage}
          totalPages={totalPoPages}
          numberLocale={numberLocale}
          labels={localeText.pagination}
          hrefForPage={(page) =>
            buildDashboardUrl({
              q: searchTerm,
              category: categoryFilter,
              page: safeReportingPage,
              packagePage: safePackagePage,
              coursePage: safeCoursePage,
              poPage: page,
              courseQ: params.courseQ ?? "",
              poQ: params.poQ ?? "",
            })
          }
        />
      </section>
      ) : null}

      <section className="panel-surface">
        <div className="mb-5">
          <p className="eyebrow">{localeText.home.coursesSummary}</p>
          <h2 className="section-title">{localeText.home.coursesSummary}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            href="/courses"
            title={dashboardText.coursesFramework}
            value={formatNumber(totalCourses, numberLocale)}
            detail={localeText.home.catalogSnapshot}
          />
          <KpiCard
            href="/trainings"
            title={homeUiText.trainings}
            value={formatNumber(totalRuns, numberLocale)}
            detail={homeUiText.completedOngoingUpcoming
              .replace("{completed}", formatNumber(completedRuns, numberLocale))
              .replace("{ongoing}", formatNumber(ongoingRuns, numberLocale))
              .replace("{upcoming}", formatNumber(upcomingRunsCount, numberLocale))}
          />
          <KpiCard
            href="/courses"
            title={homeUiText.attendees}
            value={formatNumber(allTimeTrainees, numberLocale)}
            detail={homeUiText.activeNow.replace("{active}", formatNumber(activeTrainees, numberLocale))}
          />
          <KpiCard
            href="/trainings"
            title={homeUiText.seatUtilization}
            value={formatPercent(seatUtilization, numberLocale)}
            detail={homeUiText.actualEstimatedSeats
              .replace("{actual}", formatNumber(filledSeats, numberLocale))
              .replace("{estimated}", formatNumber(allocatedSeats, numberLocale))}
          />
          <KpiCard
            href="/trainings"
            title={homeUiText.satisfactionRate}
            value={formatPercent(satisfactionRate, numberLocale)}
            detail={homeUiText.feedbackEntries.replace(
              "{count}",
              formatNumber(qualitySatisfactionRows.length || evaluationRows.length, numberLocale),
            )}
          />
          <KpiCard
            href="/vendors"
            title={homeUiText.activeInstructors}
            value={formatNumber(activeTrainerCount, numberLocale)}
            detail={homeUiText.approvedInstructorsLive}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <ActivityPanel title={homeUiText.trainingsRunningToday} emptyText={homeUiText.noItems} items={todayRuns.map((run) => ({
          href: `/trainings/${run.id}`,
          title: run.course.nameEn || run.course.nameAr,
          meta: `${run.location?.nameEn || run.location?.nameAr || run.location?.city || "-"} / ${run.trainers[0]?.trainer.fullNameEn || run.trainers[0]?.trainer.fullNameAr || "-"}`,
        }))} />
        <ActivityPanel title={homeUiText.upcomingNextSevenDays} emptyText={homeUiText.noItems} items={upcomingRuns.map((run) => ({
          href: `/trainings/${run.id}`,
          title: run.course.nameEn || run.course.nameAr,
          meta: `${formatDate(run.startDate, numberLocale)} / ${run.location?.nameEn || run.location?.nameAr || run.location?.city || "-"}`,
        }))} />
        <ActivityPanel title={homeUiText.completedLastSevenDays} emptyText={homeUiText.noItems} items={recentlyCompletedRuns.map((run) => ({
          href: `/trainings/${run.id}`,
          title: run.course.nameEn || run.course.nameAr,
          meta: `${formatDate(run.endDate, numberLocale)} / ${run.location?.nameEn || run.location?.nameAr || run.location?.city || "-"}`,
        }))} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartPanel title={dashboardText.poCompletionChart}>
          {scopeProgress.map((item) => (
            <ProgressRow
              key={item.code}
              label={item.name}
              value={item.percent}
              detail={homeUiText.progressOfTotal
                .replace("{completed}", formatNumber(item.completed, numberLocale))
                .replace("{total}", formatNumber(item.total, numberLocale))}
            />
          ))}
        </ChartPanel>
        <ChartPanel title={dashboardText.monthlyTrainingActivity}>
          <BarChart rows={monthlyChart} numberLocale={numberLocale} emptyText={homeUiText.noItems} />
        </ChartPanel>
      </section>

      {/* Hidden for now by request. Restore by setting SHOW_DASHBOARD_REPORTING to true. */}
      {SHOW_DASHBOARD_REPORTING && canSeeFinancials ? (
      <section className="panel-surface">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">{localeText.reporting.title}</p>
            <h2 className="section-title">{localeText.reporting.title}</h2>
          </div>
          <a href={reportExportUrl} className="primary-button">
            {localeText.reporting.exportCsv}
          </a>
        </div>

        <form className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_0.8fr_auto]">
          <InstantSearchField
            label={localeText.reporting.search}
            defaultValue={searchTerm}
            placeholder={localeText.common.searchPlaceholder}
            pageParams={["page"]}
          />
          <label className="field-shell">
            <span className="field-label">{localeText.reporting.category}</span>
            <select name="category" defaultValue={categoryFilter} className="field-input">
              <option value="">{localeText.reporting.allCategories}</option>
              {categoryOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row xl:items-end">
            <button type="submit" className="primary-button">{localeText.reporting.apply}</button>
            <Link href={buildDashboardUrl({})} className="secondary-button">{localeText.reporting.reset}</Link>
          </div>
        </form>

        <div className="mt-6 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{localeText.reporting.number}</th>
                <th>{localeText.reporting.category}</th>
                <th>{localeText.reporting.nameDescription}</th>
                <th>{localeText.reporting.relatedCourseProject}</th>
                <th>{localeText.reporting.ownerResponsible}</th>
                <th>{localeText.reporting.status}</th>
                <th>{localeText.reporting.date}</th>
                <th>{localeText.reporting.notes}</th>
              </tr>
            </thead>
            <tbody>
              {visibleReportingRows.map((row, index) => (
                <tr key={row.id}>
                  <td className="latin-cell">
                    {formatNumber((safeReportingPage - 1) * DASHBOARD_TABLE_PAGE_SIZE + index + 1, numberLocale)}
                  </td>
                  <td>{row.categoryLabel}</td>
                  <td>{row.name}</td>
                  <td>{row.related}</td>
                  <td>{row.owner}</td>
                  <td><span className="status-pill">{row.status}</span></td>
                  <td>{formatReportingDate(row.date, locale)}</td>
                  <td>{row.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {reportingRows.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--ink-soft)]">
              {localeText.reporting.noRows}
            </p>
          ) : null}
        </div>
        {reportingRows.length > DASHBOARD_TABLE_PAGE_SIZE ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-[var(--ink-soft)]">
              {localeText.pagination.pageIndicator
                .replace("{current}", formatNumber(safeReportingPage, numberLocale))
                .replace("{total}", formatNumber(totalReportingPages, numberLocale))}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={buildDashboardUrl({
                  q: searchTerm,
                  category: categoryFilter,
                  page: 1,
                  packagePage: safePackagePage,
                  coursePage: safeCoursePage,
                  poPage: safePoPage,
                })}
                aria-disabled={safeReportingPage <= 1}
                className={`pagination-link ${safeReportingPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                {localeText.pagination.first}
              </Link>
              <Link
                href={buildDashboardUrl({
                  q: searchTerm,
                  category: categoryFilter,
                  page: Math.max(1, safeReportingPage - 1),
                  packagePage: safePackagePage,
                  coursePage: safeCoursePage,
                  poPage: safePoPage,
                })}
                aria-disabled={safeReportingPage <= 1}
                className={`pagination-link ${safeReportingPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                {localeText.pagination.previous}
              </Link>
              {paginationPages(safeReportingPage, totalReportingPages).map((page, index) =>
                page === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                    ...
                  </span>
                ) : (
                  <Link
                    key={page}
                    href={buildDashboardUrl({
                      q: searchTerm,
                      category: categoryFilter,
                      page,
                      packagePage: safePackagePage,
                      coursePage: safeCoursePage,
                      poPage: safePoPage,
                    })}
                    aria-current={page === safeReportingPage ? "page" : undefined}
                    className={`pagination-link ${page === safeReportingPage ? "pagination-link-active" : ""}`}
                  >
                    {formatNumber(page, numberLocale)}
                  </Link>
                ),
              )}
              <Link
                href={buildDashboardUrl({
                  q: searchTerm,
                  category: categoryFilter,
                  page: Math.min(totalReportingPages, safeReportingPage + 1),
                  packagePage: safePackagePage,
                  coursePage: safeCoursePage,
                  poPage: safePoPage,
                })}
                aria-disabled={safeReportingPage >= totalReportingPages}
                className={`pagination-link ${safeReportingPage >= totalReportingPages ? "pointer-events-none opacity-50" : ""}`}
              >
                {localeText.pagination.next}
              </Link>
              <Link
                href={buildDashboardUrl({
                  q: searchTerm,
                  category: categoryFilter,
                  page: totalReportingPages,
                  packagePage: safePackagePage,
                  coursePage: safeCoursePage,
                  poPage: safePoPage,
                })}
                aria-disabled={safeReportingPage >= totalReportingPages}
                className={`pagination-link ${safeReportingPage >= totalReportingPages ? "pointer-events-none opacity-50" : ""}`}
              >
                {localeText.pagination.last}
              </Link>
            </div>
          </div>
        ) : null}
      </section>
      ) : null}
    </div>
  );
}

function KpiCard({
  href,
  title,
  value,
  detail,
  tone = "normal",
}: {
  href: string;
  title: string;
  value: string;
  detail?: string;
  tone?: "normal" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-500 bg-red-50"
      : tone === "warning"
        ? "border-amber-400 bg-amber-50"
        : "border-[var(--brand-yellow)] bg-white";

  return (
    <Link href={href} className={`block rounded-[8px] border p-5 shadow-[0_18px_44px_rgba(17,17,17,0.05)] transition hover:-translate-y-0.5 ${toneClass}`}>
      <p className="text-sm font-semibold text-[var(--ink-soft)]">{title}</p>
      <p className="mt-3 text-3xl font-bold text-[var(--ink-strong)]">{value}</p>
      {detail ? <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{detail}</p> : null}
    </Link>
  );
}

function ProjectSummarySection({
  localeText,
  numberLocale,
  projectSummary,
  canSeeFinancials,
}: {
  localeText: ReturnType<typeof t>;
  numberLocale: string;
  canSeeFinancials: boolean;
  projectSummary: {
    startDate: Date | null;
    expectedEndDate: Date | null;
    baselineProgress: Prisma.Decimal;
    actualProgress: Prisma.Decimal;
    totalProjectValue: Prisma.Decimal;
    totalProjectInvoices: Prisma.Decimal;
    totalCollectedValue: Prisma.Decimal;
    remainingUnbilledValue: Prisma.Decimal;
  };
}) {
  return (
    <section className="panel-surface">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">{localeText.home.projectSummary}</p>
          <h2 className="section-title">{localeText.home.projectSummary}</h2>
        </div>
        <Link href="/project-details" className="primary-button">
          {localeText.buttons.projectDetails}
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReadOnlySummaryCard
          label={localeText.projectOverview.startDate}
          value={formatDate(projectSummary.startDate, numberLocale)}
        />
        <ReadOnlySummaryCard
          label={localeText.projectOverview.expectedEndDate}
          value={formatDate(projectSummary.expectedEndDate, numberLocale)}
        />
        <ReadOnlyProgressCard
          label={localeText.projectOverview.baselineProgress}
          value={formatPercent(decimalToNumber(projectSummary.baselineProgress), numberLocale)}
          percent={decimalToNumber(projectSummary.baselineProgress)}
        />
        <ReadOnlyProgressCard
          label={localeText.projectOverview.actualProgress}
          value={formatPercent(decimalToNumber(projectSummary.actualProgress), numberLocale)}
          percent={decimalToNumber(projectSummary.actualProgress)}
        />
        {canSeeFinancials ? (
          <>
            <ReadOnlySummaryCard
              label={localeText.projectOverview.totalProjectValue}
              value={formatCurrency(decimalToNumber(projectSummary.totalProjectValue), numberLocale)}
            />
            <ReadOnlySummaryCard
              label={localeText.projectOverview.totalProjectInvoices}
              value={formatCurrency(decimalToNumber(projectSummary.totalProjectInvoices), numberLocale)}
            />
            <ReadOnlySummaryCard
              label={localeText.projectOverview.totalCollectedValue}
              value={formatCurrency(decimalToNumber(projectSummary.totalCollectedValue), numberLocale)}
            />
            <ReadOnlySummaryCard
              label={localeText.projectOverview.remainingUnbilledValue}
              value={formatCurrency(decimalToNumber(projectSummary.remainingUnbilledValue), numberLocale)}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

function ReadOnlySummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="jawraa-subcard p-4">
      <p className="text-sm font-semibold text-[var(--ink-soft)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}

function ReadOnlyProgressCard({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  percent: number;
}) {
  const clamped = Math.min(Math.max(percent, 0), 100);

  return (
    <div className="jawraa-subcard p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--ink-soft)]">{label}</p>
        <p className="text-sm font-bold text-[var(--ink-strong)]">{value}</p>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[rgba(17,17,17,0.08)]">
        <div
          className="h-full rounded-full bg-[var(--brand-yellow)]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function DashboardPagination({
  currentPage,
  totalPages,
  numberLocale,
  labels,
  hrefForPage,
}: {
  currentPage: number;
  totalPages: number;
  numberLocale: string;
  labels: ReturnType<typeof t>["pagination"];
  hrefForPage: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-[var(--ink-soft)]">
        {labels.pageIndicator
          .replace("{current}", formatNumber(currentPage, numberLocale))
          .replace("{total}", formatNumber(totalPages, numberLocale))}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={hrefForPage(1)}
          aria-disabled={currentPage <= 1}
          className={`pagination-link ${currentPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
        >
          {labels.first}
        </Link>
        <Link
          href={hrefForPage(Math.max(1, currentPage - 1))}
          aria-disabled={currentPage <= 1}
          className={`pagination-link ${currentPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
        >
          {labels.previous}
        </Link>
        {paginationPages(currentPage, totalPages).map((page, index) =>
          page === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="pagination-ellipsis">
              ...
            </span>
          ) : (
            <Link
              key={page}
              href={hrefForPage(page)}
              aria-current={page === currentPage ? "page" : undefined}
              className={`pagination-link ${page === currentPage ? "pagination-link-active" : ""}`}
            >
              {formatNumber(page, numberLocale)}
            </Link>
          ),
        )}
        <Link
          href={hrefForPage(Math.min(totalPages, currentPage + 1))}
          aria-disabled={currentPage >= totalPages}
          className={`pagination-link ${currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
        >
          {labels.next}
        </Link>
        <Link
          href={hrefForPage(totalPages)}
          aria-disabled={currentPage >= totalPages}
          className={`pagination-link ${currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
        >
          {labels.last}
        </Link>
      </div>
    </div>
  );
}

function ActivityPanel({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: Array<{ href: string; title: string; meta: string }>;
  emptyText: string;
}) {
  return (
    <section className="panel-surface">
      <h2 className="text-lg font-semibold text-[var(--ink-strong)]">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? items.map((item) => (
          <Link key={`${item.href}-${item.title}`} href={item.href} className="block rounded-[8px] border border-[rgba(17,17,17,0.1)] p-3 transition hover:border-[var(--brand-yellow)]">
            <p className="font-semibold text-[var(--ink-strong)]">{item.title}</p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{item.meta}</p>
          </Link>
        )) : <p className="text-sm text-[var(--ink-soft)]">{emptyText}</p>}
      </div>
    </section>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel-surface">
      <h2 className="text-lg font-semibold text-[var(--ink-strong)]">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function ProgressRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-[var(--ink-strong)]">{label}</span>
        <span className="text-[var(--ink-soft)]">{detail}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[rgba(17,17,17,0.08)]">
        <div className="h-full rounded-full bg-[var(--brand-yellow)]" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
      </div>
    </div>
  );
}

function BarChart({
  rows,
  numberLocale,
  emptyText,
  suffix = "",
  maxValue,
}: {
  rows: Array<{ label: string; value: number }>;
  numberLocale: string;
  emptyText: string;
  suffix?: string;
  maxValue?: number;
}) {
  const max = maxValue ?? Math.max(...rows.map((row) => row.value), 1);
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--ink-soft)]">{emptyText}</p>;
  }
  return (
    <div className="grid min-h-[220px] grid-cols-[repeat(auto-fit,minmax(56px,1fr))] items-end gap-3">
      {rows.map((row) => (
        <div key={row.label} className="flex h-full min-h-[190px] flex-col justify-end gap-2">
          <div className="flex flex-1 items-end rounded-[8px] bg-[rgba(17,17,17,0.05)]">
            <div className="w-full rounded-[8px] bg-[var(--brand-yellow)]" style={{ height: `${Math.max(4, ratio(row.value, max))}%` }} />
          </div>
          <p className="text-center text-xs font-semibold text-[var(--ink-soft)]">{row.label}</p>
          <p className="text-center text-xs text-[var(--ink-strong)]">
            {new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(row.value)}{suffix}
          </p>
        </div>
      ))}
    </div>
  );
}
