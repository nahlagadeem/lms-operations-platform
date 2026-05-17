import Link from "next/link";
import {
  ApprovalStatus,
  AttendanceStatus,
  CourseRunStatus,
  Prisma,
  ReportStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { getLocale, t } from "@/lib/locale";

type HomePageProps = {
  searchParams?: Promise<{
    role?: string;
    q?: string;
    status?: string;
    scope?: string;
    alert?: string;
  }>;
};

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

const pendingApprovalDays = 3;
const lowSeatFillThreshold = 60;

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
  status?: string;
  scope?: string;
  alert?: string;
}) {
  const search = new URLSearchParams();
  if (params.role !== "GOVERNMENT_PROJECT_MANAGER") search.set("role", params.role);
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.scope) search.set("scope", params.scope);
  if (params.alert) search.set("alert", params.alert);
  const query = search.toString();
  return query ? `/?${query}` : "/";
}

export const revalidate = 0;

export default async function HomePage({ searchParams }: HomePageProps) {
  const locale = await getLocale();
  const localeText = t(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";
  const params = (await searchParams) ?? {};
  const role = dashboardRole(params.role);
  const showFinance = true;
  const searchTerm = normalize(params.q);
  const statusFilter = normalize(params.status) as CourseRunStatus | "";
  const scopeFilter = normalize(params.scope);
  const alertFilter = normalize(params.alert);

  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const nextSevenDays = addDays(todayStart, 7);
  const lastSevenDays = addDays(todayStart, -7);
  const pendingApprovalCutoff = addDays(todayStart, -pendingApprovalDays);

  const reportingWhere: Prisma.CourseRunWhereInput = {
    status: statusFilter || undefined,
    course: scopeFilter
      ? {
          scopeSelections: {
            some: {
              scope: {
                code: scopeFilter,
              },
            },
          },
        }
      : undefined,
    OR: searchTerm
      ? [
          { runCode: { contains: searchTerm, mode: "insensitive" } },
          { course: { courseCode: { contains: searchTerm, mode: "insensitive" } } },
          { course: { nameAr: { contains: searchTerm, mode: "insensitive" } } },
          { course: { nameEn: { contains: searchTerm, mode: "insensitive" } } },
          { provider: { nameAr: { contains: searchTerm, mode: "insensitive" } } },
          { provider: { nameEn: { contains: searchTerm, mode: "insensitive" } } },
        ]
      : undefined,
  };

  if (alertFilter === "overdue-reports") {
    reportingWhere.qualityReports = {
      some: {
        reportStatus: { notIn: [ReportStatus.SUBMITTED, ReportStatus.APPROVED] },
        dueDate: { lt: todayStart },
      },
    };
  }

  if (alertFilter === "pending-approvals") {
    reportingWhere.approvalStatus = ApprovalStatus.PENDING;
    reportingWhere.updatedAt = { lt: pendingApprovalCutoff };
  }

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
    pendingApprovals,
    overdueQualityReports,
    dueSoonQualityReports,
    oldPendingApprovals,
    lowFillRuns,
    scopes,
    scopeRows,
    monthlyRuns,
    utilizationByScope,
    satisfactionTrendRows,
    todayRuns,
    upcomingRuns,
    recentlyCompletedRuns,
    financeScopes,
    packageValues,
    reportingRows,
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
    db.courseRun.count({
      where: { approvalStatus: ApprovalStatus.PENDING },
    }),
    db.qualityReport.count({
      where: {
        reportStatus: { notIn: [ReportStatus.SUBMITTED, ReportStatus.APPROVED] },
        dueDate: { lt: todayStart },
      },
    }),
    db.qualityReport.count({
      where: {
        reportStatus: { notIn: [ReportStatus.SUBMITTED, ReportStatus.APPROVED] },
        dueDate: { gte: todayStart, lt: addDays(todayStart, 3) },
      },
    }),
    db.courseRun.count({
      where: {
        approvalStatus: ApprovalStatus.PENDING,
        updatedAt: { lt: pendingApprovalCutoff },
      },
    }),
    db.courseRun.findMany({
      where: {
        plannedSeats: { gt: 0 },
        status: { in: liveRunStatuses },
      },
      include: {
        course: {
          select: { nameAr: true, nameEn: true },
        },
      },
      orderBy: { startDate: "asc" },
      take: 60,
    }),
    db.projectScope.findMany({
      select: { code: true, name: true },
      orderBy: { code: "asc" },
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
    db.projectScope.findMany({
      select: {
        code: true,
        name: true,
        selectedCourses: {
          select: {
            course: {
              select: {
                runs: {
                  select: { plannedSeats: true, confirmedSeats: true },
                },
              },
            },
          },
        },
      },
      orderBy: { code: "asc" },
    }),
    db.qualityReport.findMany({
      select: { submittedAt: true, createdAt: true, satisfactionRate: true },
      where: { satisfactionRate: { not: null } },
      orderBy: { createdAt: "asc" },
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
    db.projectScope.findMany({
      select: {
        budgetAmount: true,
        invoicedAmount: true,
        collectedAmount: true,
        plannedCompletion: true,
        actualCompletion: true,
      },
    }),
    db.package.findMany({
      select: { discountedTotalAmount: true, originalTotalAmount: true },
    }),
    db.courseRun.findMany({
      where: reportingWhere,
      include: {
        course: {
          include: {
            package: { select: { code: true, nameAr: true, nameEn: true } },
            scopeSelections: {
              include: { scope: { select: { code: true, name: true } } },
            },
          },
        },
        location: { select: { nameAr: true, nameEn: true, city: true } },
        qualityReports: {
          select: { reportStatus: true, dueDate: true, satisfactionRate: true },
          orderBy: { dueDate: "desc" },
          take: 1,
        },
        _count: {
          select: { nominations: true, attendanceRecords: true, evaluations: true },
        },
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      take: 75,
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
  const lowFillCount = lowFillRuns.filter((run) => {
    const fillRate = ratio(run.confirmedSeats, run.plannedSeats ?? 0);
    return fillRate < lowSeatFillThreshold;
  }).length;

  const contractValueFromScopes = financeScopes.reduce(
    (sum, item) => sum + decimalToNumber(item.budgetAmount),
    0,
  );
  const contractValue =
    contractValueFromScopes ||
    packageValues.reduce(
      (sum, item) =>
        sum +
        decimalToNumber(item.discountedTotalAmount ?? item.originalTotalAmount),
      0,
    );
  const invoicedAmount = financeScopes.reduce(
    (sum, item) => sum + decimalToNumber(item.invoicedAmount),
    0,
  );
  const collectedAmount = financeScopes.reduce(
    (sum, item) => sum + decimalToNumber(item.collectedAmount),
    0,
  );
  const remainingAmount = Math.max(contractValue - invoicedAmount, 0);
  const plannedCompletion =
    financeScopes.length > 0
      ? financeScopes.reduce((sum, item) => sum + decimalToNumber(item.plannedCompletion), 0) /
        financeScopes.length
      : 0;
  const actualCompletion =
    financeScopes.length > 0
      ? financeScopes.reduce((sum, item) => sum + decimalToNumber(item.actualCompletion), 0) /
        financeScopes.length
      : 0;
  const completionState = actualCompletion + 2 >= plannedCompletion ? "On track" : "Delayed";
  const budgetConsumed = ratio(invoicedAmount, contractValue);

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
      name: scope.name,
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

  const utilizationChart = utilizationByScope.map((scope) => {
    const seats = scope.selectedCourses.flatMap((selection) => selection.course.runs);
    const allocated = seats.reduce((sum, item) => sum + (item.plannedSeats ?? 0), 0);
    const filled = seats.reduce((sum, item) => sum + item.confirmedSeats, 0);
    return {
      label: scope.code,
      name: scope.name,
      value: ratio(filled, allocated),
    };
  });

  const satisfactionTrend = satisfactionTrendRows.reduce<Record<string, { total: number; count: number }>>(
    (groups, report) => {
      const date = report.submittedAt ?? report.createdAt;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const current = groups[key] ?? { total: 0, count: 0 };
      groups[key] = {
        total: current.total + decimalToNumber(report.satisfactionRate),
        count: current.count + 1,
      };
      return groups;
    },
    {},
  );
  const satisfactionChart = Object.entries(satisfactionTrend)
    .slice(-8)
    .map(([month, item]) => ({ label: month, value: item.count ? item.total / item.count : 0 }));

  const reportExportUrl = `/api/dashboard-report?${new URLSearchParams({
    role,
    ...(searchTerm ? { q: searchTerm } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(scopeFilter ? { scope: scopeFilter } : {}),
    ...(alertFilter ? { alert: alertFilter } : {}),
  }).toString()}`;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="section-title">Project health dashboard</h1>
          <p className="section-copy">
            Live course, participant, report, and finance numbers from the database.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={buildDashboardUrl({ role })} className="primary-button">
            Refresh
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          href="/courses"
          title="Courses framework"
          value={formatNumber(totalCourses, numberLocale)}
          detail={`${formatNumber(completedCourseIds.length, numberLocale)} completed / ${formatNumber(ongoingCourseIds.length, numberLocale)} ongoing / ${formatNumber(plannedCourseIds.length, numberLocale)} planned`}
        />
        <KpiCard
          href="/course-runs"
          title="Active Courses"
          value={formatNumber(totalRuns, numberLocale)}
          detail={`${formatNumber(completedRuns, numberLocale)} completed / ${formatNumber(ongoingRuns, numberLocale)} ongoing / ${formatNumber(upcomingRunsCount, numberLocale)} upcoming`}
        />
        <KpiCard
          href="/courses"
          title="Participants"
          value={formatNumber(allTimeTrainees, numberLocale)}
          detail={`${formatNumber(activeTrainees, numberLocale)} active right now`}
        />
        <KpiCard
          href="/course-runs"
          title="Seat utilization"
          value={formatPercent(seatUtilization, numberLocale)}
          detail={`${formatNumber(filledSeats, numberLocale)} filled / ${formatNumber(allocatedSeats, numberLocale)} allocated`}
        />
        <KpiCard
          href="/course-runs"
          title="Participant success rate"
          value={formatPercent(successRate, numberLocale)}
          detail={`${formatNumber(successfulAttendance, numberLocale)} successful attendance entries`}
        />
        <KpiCard
          href="/course-runs"
          title="Satisfaction rate"
          value={formatPercent(satisfactionRate, numberLocale)}
          detail={`${formatNumber(qualitySatisfactionRows.length || evaluationRows.length, numberLocale)} feedback entries`}
        />
        <KpiCard
          href="/providers"
          title="Active trainers"
          value={formatNumber(activeTrainerCount, numberLocale)}
          detail="Approved trainers assigned to live work"
        />
        <KpiCard
          href={buildDashboardUrl({ role, alert: "pending-approvals" })}
          title="Pending approvals"
          value={formatNumber(pendingApprovals, numberLocale)}
          detail={`${formatNumber(oldPendingApprovals, numberLocale)} waiting more than ${pendingApprovalDays} days`}
          tone={pendingApprovals > 0 ? "warning" : "normal"}
        />
        <KpiCard
          href={buildDashboardUrl({ role, alert: "overdue-reports" })}
          title="Reports overdue"
          value={formatNumber(overdueQualityReports, numberLocale)}
          detail="Report deadline missed"
          tone={overdueQualityReports > 0 ? "danger" : "normal"}
        />
      </section>

      {showFinance ? (
        <section className="panel-surface">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Module B</p>
              <h2 className="section-title">Financial snapshot</h2>
            </div>
            <StatusBadge label={completionState} tone={completionState === "On track" ? "success" : "danger"} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard href="/project-structure" title="Total contract value" value={formatCurrency(contractValue, numberLocale)} />
            <KpiCard href="/project-structure" title="Invoiced so far" value={formatCurrency(invoicedAmount, numberLocale)} />
            <KpiCard href="/project-structure" title="Collected" value={formatCurrency(collectedAmount, numberLocale)} />
            <KpiCard href="/project-structure" title="Remaining" value={formatCurrency(remainingAmount, numberLocale)} />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <ProgressPanel
              title="Project completion"
              primaryLabel={`Actual ${formatPercent(actualCompletion, numberLocale)}`}
              secondaryLabel={`Baseline ${formatPercent(plannedCompletion, numberLocale)}`}
              value={actualCompletion}
              benchmark={plannedCompletion}
            />
            <ProgressPanel
              title="Budget consumed vs remaining"
              primaryLabel={`${formatPercent(budgetConsumed, numberLocale)} consumed`}
              secondaryLabel={formatCurrency(remainingAmount, numberLocale)}
              value={budgetConsumed}
            />
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-3">
        <ActivityPanel title="Courses running today" items={todayRuns.map((run) => ({
          href: `/course-runs/${run.id}`,
          title: run.course.nameEn || run.course.nameAr,
          meta: `${run.location?.nameEn || run.location?.nameAr || run.location?.city || "-"} / ${run.trainers[0]?.trainer.fullNameEn || run.trainers[0]?.trainer.fullNameAr || "-"}`,
        }))} />
        <ActivityPanel title="Upcoming in next 7 days" items={upcomingRuns.map((run) => ({
          href: `/course-runs/${run.id}`,
          title: run.course.nameEn || run.course.nameAr,
          meta: `${formatDate(run.startDate, numberLocale)} / ${run.location?.nameEn || run.location?.nameAr || run.location?.city || "-"}`,
        }))} />
        <ActivityPanel title="Completed in last 7 days" items={recentlyCompletedRuns.map((run) => ({
          href: `/course-runs/${run.id}`,
          title: run.course.nameEn || run.course.nameAr,
          meta: `${formatDate(run.endDate, numberLocale)} / ${run.location?.nameEn || run.location?.nameAr || run.location?.city || "-"}`,
        }))} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartPanel title="Course completion by project scope">
          {scopeProgress.map((item) => (
            <ProgressRow
              key={item.code}
              label={`${item.code} ${item.name}`}
              value={item.percent}
              detail={`${formatNumber(item.completed, numberLocale)} of ${formatNumber(item.total, numberLocale)}`}
            />
          ))}
        </ChartPanel>
        <ChartPanel title="Monthly training activity">
          <BarChart rows={monthlyChart} numberLocale={numberLocale} />
        </ChartPanel>
        <ChartPanel title="Seat utilization by project scope">
          {utilizationChart.map((item) => (
            <ProgressRow
              key={item.label}
              label={`${item.label} ${item.name}`}
              value={item.value}
              detail={formatPercent(item.value, numberLocale)}
            />
          ))}
        </ChartPanel>
        <ChartPanel title="Participant satisfaction trend">
          <BarChart rows={satisfactionChart} numberLocale={numberLocale} suffix="%" maxValue={100} />
        </ChartPanel>
      </section>

      <section className="panel-surface">
        <div className="mb-5">
          <p className="eyebrow">Alerts and Report Deadlines</p>
          <h2 className="section-title">Immediate attention</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AlertCard href={buildDashboardUrl({ role })} title="Reports due within 3 days" value={dueSoonQualityReports} tone="warning" locale={numberLocale} />
          <AlertCard href={buildDashboardUrl({ role, alert: "overdue-reports" })} title="Reports overdue" value={overdueQualityReports} tone="danger" locale={numberLocale} />
          <AlertCard href={buildDashboardUrl({ role, alert: "pending-approvals" })} title={`Approvals over ${pendingApprovalDays} days`} value={oldPendingApprovals} tone="warning" locale={numberLocale} />
          <AlertCard href={buildDashboardUrl({ role })} title={`Runs below ${lowSeatFillThreshold}% fill`} value={lowFillCount} tone="warning" locale={numberLocale} />
        </div>
      </section>

      <section className="panel-surface">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Reporting</p>
            <h2 className="section-title">Filterable reporting table</h2>
          </div>
          <a href={reportExportUrl} className="primary-button">
            Export CSV
          </a>
        </div>

        <form className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_auto]">
          <input type="hidden" name="role" value={role} />
          <label className="field-shell">
            <span className="field-label">Search</span>
            <input name="q" type="search" defaultValue={searchTerm} className="field-input" placeholder="Course, session, or training provider" />
          </label>
          <label className="field-shell">
            <span className="field-label">Status</span>
            <select name="status" defaultValue={statusFilter} className="field-input">
              <option value="">All statuses</option>
              {Object.values(CourseRunStatus).map((item) => (
                <option key={item} value={item}>{localeText.courseRunStatuses[item]}</option>
              ))}
            </select>
          </label>
          <label className="field-shell">
            <span className="field-label">Project Scope</span>
            <select name="scope" defaultValue={scopeFilter} className="field-input">
              <option value="">All project scopes</option>
              {scopes.map((scope) => (
                <option key={scope.code} value={scope.code}>{scope.code} {scope.name}</option>
              ))}
            </select>
          </label>
          <label className="field-shell">
            <span className="field-label">Alert</span>
            <select name="alert" defaultValue={alertFilter} className="field-input">
              <option value="">All runs</option>
              <option value="overdue-reports">Overdue reports</option>
              <option value="pending-approvals">Pending approvals</option>
            </select>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row xl:items-end">
            <button type="submit" className="primary-button">Apply</button>
            <Link href={buildDashboardUrl({ role })} className="secondary-button">Reset</Link>
          </div>
        </form>

        <div className="mt-6 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Course</th>
                <th>Project Scope</th>
                <th>Status</th>
                <th>Dates</th>
                <th>Seats</th>
                <th>Report</th>
                <th>Satisfaction</th>
              </tr>
            </thead>
            <tbody>
              {reportingRows.map((run) => {
                const qualityReport = run.qualityReports[0];
                const scopesLabel = run.course.scopeSelections
                  .map((selection) => selection.scope.code)
                  .join(", ") || "-";
                return (
                  <tr key={run.id}>
                    <td className="latin-cell">
                      <Link href={`/course-runs/${run.id}`} className="block w-full font-semibold">{run.runCode}</Link>
                    </td>
                    <td>{run.course.nameEn || run.course.nameAr}</td>
                    <td>{scopesLabel}</td>
                    <td><span className="status-pill">{localeText.courseRunStatuses[run.status]}</span></td>
                    <td>{formatDate(run.startDate, numberLocale)} - {formatDate(run.endDate, numberLocale)}</td>
                    <td>{formatNumber(run.confirmedSeats, numberLocale)} / {formatNumber(run.plannedSeats ?? 0, numberLocale)}</td>
                    <td>{qualityReport ? qualityReport.reportStatus : "-"}</td>
                    <td>{qualityReport?.satisfactionRate ? formatPercent(decimalToNumber(qualityReport.satisfactionRate), numberLocale) : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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

function StatusBadge({ label, tone }: { label: string; tone: "success" | "danger" }) {
  return (
    <span className={`status-pill ${tone === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
      {label}
    </span>
  );
}

function ProgressPanel({
  title,
  primaryLabel,
  secondaryLabel,
  value,
  benchmark,
}: {
  title: string;
  primaryLabel: string;
  secondaryLabel: string;
  value: number;
  benchmark?: number;
}) {
  return (
    <div className="jawraa-subcard p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-[var(--ink-strong)]">{title}</p>
        <p className="text-sm text-[var(--ink-soft)]">{secondaryLabel}</p>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[rgba(17,17,17,0.08)]">
        <div className="h-full rounded-full bg-[var(--brand-yellow)]" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
      </div>
      {benchmark !== undefined ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(17,17,17,0.05)]">
          <div className="h-full rounded-full bg-[var(--brand-ink)]" style={{ width: `${Math.min(Math.max(benchmark, 0), 100)}%` }} />
        </div>
      ) : null}
      <p className="mt-3 text-sm font-semibold text-[var(--ink-strong)]">{primaryLabel}</p>
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

function AlertCard({
  href,
  title,
  value,
  tone,
  locale,
}: {
  href: string;
  title: string;
  value: number;
  tone: "warning" | "danger";
  locale: string;
}) {
  return (
    <Link href={href} className={`rounded-[8px] border p-4 ${tone === "danger" && value > 0 ? "border-red-500 bg-red-50" : "border-amber-400 bg-amber-50"}`}>
      <p className="text-sm font-semibold text-[var(--ink-soft)]">{title}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--ink-strong)]">{formatNumber(value, locale)}</p>
    </Link>
  );
}
