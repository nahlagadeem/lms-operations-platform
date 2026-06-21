import Link from "next/link";
import {
  AttendanceStatus,
  CourseRunStatus,
  DocumentEntityType,
  Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { getLocale, t } from "@/lib/locale";
import { formatPurchaseOrderCode, formatPurchaseOrderTitle } from "@/lib/purchase-order";
import { getProjectSummary } from "@/server/services/project-overview-service";
import {
  formatReportingDate,
  getProjectReportingRows,
  getReportingCategoryOptions,
} from "@/server/services/project-reporting-service";

type HomePageProps = {
  searchParams?: Promise<{
    role?: string;
    q?: string;
    category?: string;
    page?: string;
  }>;
};

const REPORTING_PAGE_SIZE = 15;

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

function dashboardRole(value?: string) {
  const role = normalize(value).toUpperCase();
  if (role === "TRAINER") return "TRAINER";
  if (role === "FINANCE" || role === "FINANCE_OFFICER") return "FINANCE_OFFICER";
  if (role === "OPERATIONS_COORDINATOR") return "OPERATIONS_COORDINATOR";
  if (role === "REPORTING_ANALYST") return "REPORTING_ANALYST";
  return "GOVERNMENT_PROJECT_MANAGER";
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

function buildDashboardUrl(params: {
  role: string;
  q?: string;
  category?: string;
  page?: number;
}) {
  const search = new URLSearchParams();
  if (params.role !== "GOVERNMENT_PROJECT_MANAGER") search.set("role", params.role);
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.page && params.page > 1) search.set("page", String(params.page));
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
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";
  const params = (await searchParams) ?? {};
  const role = dashboardRole(params.role);
  const searchTerm = normalize(params.q);
  const categoryFilter = normalize(params.category);
  const reportingPage = normalizePage(params.page);

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
    successGroups,
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
    db.attendanceRecord.groupBy({
      by: ["attendanceStatus"],
      _count: { _all: true },
    }),
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
                  select: { status: true },
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
    getProjectReportingRows(locale, {
      q: searchTerm,
      category: categoryFilter,
    }),
    getProjectSummary(),
    db.projectScope.findMany({
      include: {
        selectedCourses: {
          include: {
            course: {
              include: {
                runs: {
                  where: { status: { in: liveRunStatuses } },
                  include: {
                    trainers: { select: { trainerId: true } },
                    nominations: { select: { participantId: true } },
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
  const successStatuses: AttendanceStatus[] = [
    AttendanceStatus.PRESENT,
    AttendanceStatus.LATE,
    AttendanceStatus.PARTIAL,
  ];
  const totalAttendance = successGroups.reduce((sum, item) => sum + item._count._all, 0);
  const successfulAttendance = successGroups
    .filter((item) => successStatuses.includes(item.attendanceStatus))
    .reduce((sum, item) => sum + item._count._all, 0);
  const successRate = ratio(successfulAttendance, totalAttendance);
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
    role,
    ...(searchTerm ? { q: searchTerm } : {}),
    ...(categoryFilter ? { category: categoryFilter } : {}),
  }).toString()}`;
  const categoryOptions = getReportingCategoryOptions(locale);
  const totalReportingPages = Math.max(
    1,
    Math.ceil(reportingRows.length / REPORTING_PAGE_SIZE),
  );
  const safeReportingPage = Math.min(reportingPage, totalReportingPages);
  const visibleReportingRows = reportingRows.slice(
    (safeReportingPage - 1) * REPORTING_PAGE_SIZE,
    safeReportingPage * REPORTING_PAGE_SIZE,
  );
  const scopeDocumentCountById = new Map(
    scopeDocumentCounts.map((item) => [item.entityId, item._count._all]),
  );
  const projectScopeSummaryRows = projectScopeRows.map((scope) => {
    const activeRuns = scope.selectedCourses.flatMap((selection) => selection.course.runs);
    const trainerIds = new Set(
      activeRuns.flatMap((run) => run.trainers.map((trainer) => trainer.trainerId)),
    );
    const participantIds = new Set(
      activeRuns.flatMap((run) =>
        run.nominations.map((nomination) => nomination.participantId),
      ),
    );

    return {
      id: scope.id,
      code: formatPurchaseOrderCode(scope.code, locale),
      name: formatPurchaseOrderTitle(scope, locale),
      status: scope.isActive ? localeText.projectScopes.active : localeText.projectScopes.inactive,
      courses: scope.selectedCourses.length,
      activeRuns: activeRuns.length,
      trainers: trainerIds.size,
      participants: participantIds.size,
      documents: scopeDocumentCountById.get(scope.id) ?? 0,
    };
  });

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">{localeText.home.dashboardEyebrow}</p>
          <h1 className="section-title">{localeText.home.projectIndicatorsTitle}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={buildDashboardUrl({ role })} className="primary-button">
            Refresh
          </Link>
        </div>
      </section>

      <ProjectSummarySection
        localeText={localeText}
        numberLocale={numberLocale}
        projectSummary={projectSummary}
      />

      <section className="panel-surface">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">{localeText.projectScopes.summaryTitle}</p>
            <h2 className="section-title">{localeText.projectScopes.summaryTitle}</h2>
          </div>
          <Link href="/project-structure" className="primary-button">
            {localeText.projectScopes.viewDetails}
          </Link>
        </div>
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ReadOnlySummaryCard
            label={localeText.projectScopes.totalProjectScopes}
            value={formatNumber(projectScopeSummaryRows.length, numberLocale)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{localeText.projectScopes.scope}</th>
                <th>{localeText.projectScopes.status}</th>
                <th>{localeText.projectScopes.courses}</th>
                <th>{localeText.projectScopes.activeRuns}</th>
                <th>{localeText.projectScopes.trainers}</th>
                <th>{localeText.projectScopes.participants}</th>
                <th>{localeText.projectScopes.documents}</th>
                <th>{localeText.projectScopes.viewDetails}</th>
              </tr>
            </thead>
            <tbody>
              {projectScopeSummaryRows.map((scope) => (
                <tr key={scope.id}>
                  <td>
                    <div className="space-y-1">
                      <p className="latin-chip">{scope.code}</p>
                      <p className="font-semibold text-[var(--ink-strong)]">{scope.name}</p>
                    </div>
                  </td>
                  <td><span className="status-pill">{scope.status}</span></td>
                  <td>{formatNumber(scope.courses, numberLocale)}</td>
                  <td>{formatNumber(scope.activeRuns, numberLocale)}</td>
                  <td>{formatNumber(scope.trainers, numberLocale)}</td>
                  <td>{formatNumber(scope.participants, numberLocale)}</td>
                  <td>{formatNumber(scope.documents, numberLocale)}</td>
                  <td>
                    <Link href={`/project-structure/scopes/${scope.id}`} className="secondary-button">
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
        </div>
      </section>

      <section className="panel-surface">
        <div className="mb-5">
          <p className="eyebrow">{localeText.home.coursesSummary}</p>
          <h2 className="section-title">{localeText.home.coursesSummary}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            href="/courses"
            title="Courses framework"
            value={formatNumber(totalCourses, numberLocale)}
            detail={`${formatNumber(completedCourseIds.length, numberLocale)} completed / ${formatNumber(ongoingCourseIds.length, numberLocale)} ongoing / ${formatNumber(plannedCourseIds.length, numberLocale)} planned`}
          />
          <KpiCard
            href="/trainings"
            title="Trainings"
            value={formatNumber(totalRuns, numberLocale)}
            detail={`${formatNumber(completedRuns, numberLocale)} completed / ${formatNumber(ongoingRuns, numberLocale)} ongoing / ${formatNumber(upcomingRunsCount, numberLocale)} upcoming`}
          />
          <KpiCard
            href="/courses"
            title="Attendees"
            value={formatNumber(allTimeTrainees, numberLocale)}
            detail={`${formatNumber(activeTrainees, numberLocale)} active right now`}
          />
          <KpiCard
            href="/trainings"
            title="Seat utilization"
            value={formatPercent(seatUtilization, numberLocale)}
            detail={`${formatNumber(filledSeats, numberLocale)} actual / ${formatNumber(allocatedSeats, numberLocale)} estimated seats`}
          />
          <KpiCard
            href="/trainings"
            title="Attendee success rate"
            value={formatPercent(successRate, numberLocale)}
            detail={`${formatNumber(successfulAttendance, numberLocale)} successful attendance entries`}
          />
          <KpiCard
            href="/trainings"
            title="Satisfaction rate"
            value={formatPercent(satisfactionRate, numberLocale)}
            detail={`${formatNumber(qualitySatisfactionRows.length || evaluationRows.length, numberLocale)} feedback entries`}
          />
          <KpiCard
            href="/vendors"
            title="Active instructors"
            value={formatNumber(activeTrainerCount, numberLocale)}
            detail="Approved instructors assigned to live work"
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <ActivityPanel title="Trainings running today" items={todayRuns.map((run) => ({
          href: `/trainings/${run.id}`,
          title: run.course.nameEn || run.course.nameAr,
          meta: `${run.location?.nameEn || run.location?.nameAr || run.location?.city || "-"} / ${run.trainers[0]?.trainer.fullNameEn || run.trainers[0]?.trainer.fullNameAr || "-"}`,
        }))} />
        <ActivityPanel title="Upcoming in next 7 days" items={upcomingRuns.map((run) => ({
          href: `/trainings/${run.id}`,
          title: run.course.nameEn || run.course.nameAr,
          meta: `${formatDate(run.startDate, numberLocale)} / ${run.location?.nameEn || run.location?.nameAr || run.location?.city || "-"}`,
        }))} />
        <ActivityPanel title="Completed in last 7 days" items={recentlyCompletedRuns.map((run) => ({
          href: `/trainings/${run.id}`,
          title: run.course.nameEn || run.course.nameAr,
          meta: `${formatDate(run.endDate, numberLocale)} / ${run.location?.nameEn || run.location?.nameAr || run.location?.city || "-"}`,
        }))} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
          <ChartPanel title="Course completion by purchase order">
          {scopeProgress.map((item) => (
            <ProgressRow
              key={item.code}
              label={item.name}
              value={item.percent}
              detail={`${formatNumber(item.completed, numberLocale)} of ${formatNumber(item.total, numberLocale)}`}
            />
          ))}
        </ChartPanel>
        <ChartPanel title="Monthly training activity">
          <BarChart rows={monthlyChart} numberLocale={numberLocale} />
        </ChartPanel>
      </section>

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
          <input type="hidden" name="role" value={role} />
          <label className="field-shell">
            <span className="field-label">{localeText.reporting.search}</span>
            <input
              name="q"
              type="search"
              defaultValue={searchTerm}
              className="field-input"
              placeholder={localeText.reporting.searchPlaceholder}
            />
          </label>
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
            <Link href={buildDashboardUrl({ role })} className="secondary-button">{localeText.reporting.reset}</Link>
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
                    {formatNumber((safeReportingPage - 1) * REPORTING_PAGE_SIZE + index + 1, numberLocale)}
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
        {reportingRows.length > REPORTING_PAGE_SIZE ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-[var(--ink-soft)]">
              {localeText.pagination.pageIndicator
                .replace("{current}", formatNumber(safeReportingPage, numberLocale))
                .replace("{total}", formatNumber(totalReportingPages, numberLocale))}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={buildDashboardUrl({
                  role,
                  q: searchTerm,
                  category: categoryFilter,
                  page: 1,
                })}
                aria-disabled={safeReportingPage <= 1}
                className={`pagination-link ${safeReportingPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                {localeText.pagination.first}
              </Link>
              <Link
                href={buildDashboardUrl({
                  role,
                  q: searchTerm,
                  category: categoryFilter,
                  page: Math.max(1, safeReportingPage - 1),
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
                      role,
                      q: searchTerm,
                      category: categoryFilter,
                      page,
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
                  role,
                  q: searchTerm,
                  category: categoryFilter,
                  page: Math.min(totalReportingPages, safeReportingPage + 1),
                })}
                aria-disabled={safeReportingPage >= totalReportingPages}
                className={`pagination-link ${safeReportingPage >= totalReportingPages ? "pointer-events-none opacity-50" : ""}`}
              >
                {localeText.pagination.next}
              </Link>
              <Link
                href={buildDashboardUrl({
                  role,
                  q: searchTerm,
                  category: categoryFilter,
                  page: totalReportingPages,
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
}: {
  localeText: ReturnType<typeof t>;
  numberLocale: string;
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

function ActivityPanel({
  title,
  items,
}: {
  title: string;
  items: Array<{ href: string; title: string; meta: string }>;
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
        )) : <p className="text-sm text-[var(--ink-soft)]">No items found.</p>}
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
  suffix = "",
  maxValue,
}: {
  rows: Array<{ label: string; value: number }>;
  numberLocale: string;
  suffix?: string;
  maxValue?: number;
}) {
  const max = maxValue ?? Math.max(...rows.map((row) => row.value), 1);
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--ink-soft)]">No items found.</p>;
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
