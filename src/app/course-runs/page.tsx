import Link from "next/link";
import { CourseRunStatus, DeliveryMode, Prisma } from "@prisma/client";
import { createCourseRun } from "@/app/course-runs/actions";
import { db } from "@/lib/db";
import { getLocale, t } from "@/lib/locale";

type CourseRunsPageProps = {
  searchParams?: Promise<{
    q?: string;
    package?: string;
    status?: string;
    panel?: string;
  }>;
};

const statusGroupsForPlanned = [
  CourseRunStatus.PLANNED,
  CourseRunStatus.APPROVAL_PENDING,
  CourseRunStatus.OPEN_FOR_NOMINATION,
  CourseRunStatus.CONFIRMED,
];

const statusPriority: Record<CourseRunStatus, number> = {
  ONGOING: 0,
  CONFIRMED: 1,
  OPEN_FOR_NOMINATION: 2,
  APPROVAL_PENDING: 3,
  PLANNED: 4,
  DRAFT: 5,
  POSTPONED: 6,
  COMPLETED: 7,
  CLOSED: 8,
  CANCELED: 9,
};

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function normalizeSingleValue(value?: string) {
  return value?.trim() || "";
}

function formatDateRange(
  startDate: Date | null,
  endDate: Date | null,
  locale: string,
  emptyLabel: string,
) {
  if (!startDate && !endDate) {
    return emptyLabel;
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  if (startDate && endDate) {
    return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
  }

  return formatter.format(startDate ?? endDate!);
}

function pageText(locale: "en" | "ar") {
  if (locale === "ar") {
    return {
      addButton: "إضافة تشغيل جديد",
      toggleButton: "فتح نموذج الإضافة",
      close: "إغلاق",
    };
  }

  return {
    addButton: "Add Course",
    toggleButton: "Add Course",
    close: "Close",
  };
}

export default async function CourseRunsPage({
  searchParams,
}: CourseRunsPageProps) {
  const locale = await getLocale();
  const localeText = t(locale);
  const uiText = pageText(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";
  const params = (await searchParams) ?? {};
  const openPanel = params.panel === "create" ? "create" : "";
  const searchTerm = normalizeSingleValue(params.q);
  const packageCode = normalizeSingleValue(params.package);
  const statusFilter = normalizeSingleValue(params.status) as CourseRunStatus | "";

  const whereClause: Prisma.CourseRunWhereInput = {
    status: statusFilter || undefined,
    course: packageCode
      ? {
          package: {
            code: packageCode,
          },
        }
      : undefined,
    OR: searchTerm
      ? [
          { runCode: { contains: searchTerm, mode: "insensitive" } },
          { course: { nameAr: { contains: searchTerm, mode: "insensitive" } } },
          { course: { nameEn: { contains: searchTerm, mode: "insensitive" } } },
        ]
      : undefined,
  };

  const [
    totalRuns,
    plannedRuns,
    ongoingRuns,
    completedRuns,
    packages,
    courses,
    courseRuns,
  ] = await Promise.all([
    db.courseRun.count(),
    db.courseRun.count({
      where: {
        status: {
          in: statusGroupsForPlanned,
        },
      },
    }),
    db.courseRun.count({
      where: {
        status: CourseRunStatus.ONGOING,
      },
    }),
    db.courseRun.count({
      where: {
        status: CourseRunStatus.COMPLETED,
      },
    }),
    db.package.findMany({
      select: { id: true, code: true, nameAr: true, nameEn: true },
      orderBy: { code: "asc" },
    }),
    db.course.findMany({
      select: {
        id: true,
        courseCode: true,
        nameAr: true,
        nameEn: true,
        package: {
          select: { code: true, nameAr: true, nameEn: true },
        },
      },
      orderBy: [{ package: { code: "asc" } }, { courseCode: "asc" }],
    }),
    db.courseRun.findMany({
      where: whereClause,
      include: {
        course: {
          include: {
            package: {
              select: { code: true, nameAr: true, nameEn: true },
            },
          },
        },
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
  ]);

  const prioritizedRuns = [...courseRuns].sort((left, right) => {
    const statusDiff = statusPriority[left.status] - statusPriority[right.status];
    if (statusDiff !== 0) return statusDiff;
    const leftTime = left.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightTime = right.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  });

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">{localeText.courseRuns.eyebrow}</p>
            <h2 className="section-title">{localeText.courseRuns.title}</h2>
            <p className="section-copy">{localeText.courseRuns.description}</p>
          </div>
          <Link
            href="/course-runs?panel=create"
            className="primary-button w-full sm:w-auto"
          >
            {uiText.addButton}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RunMetric title={localeText.courseRuns.totalRuns} value={formatNumber(totalRuns, numberLocale)} />
        <RunMetric title={localeText.courseRuns.plannedRuns} value={formatNumber(plannedRuns, numberLocale)} />
        <RunMetric title={localeText.courseRuns.ongoingRuns} value={formatNumber(ongoingRuns, numberLocale)} />
        <RunMetric title={localeText.courseRuns.completedRuns} value={formatNumber(completedRuns, numberLocale)} />
      </section>

      <section className="panel-surface min-w-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">{localeText.courseRuns.listTitle}</p>
            <h3 className="section-title">{localeText.courseRuns.listTitle}</h3>
            <p className="section-copy">{localeText.courseRuns.listDescription}</p>
          </div>
        </div>

        <form className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.8fr_0.8fr_auto]">
          <label className="field-shell">
            <span className="field-label">{localeText.courseRuns.search}</span>
            <input
              type="search"
              name="q"
              defaultValue={searchTerm}
              placeholder={localeText.courseRuns.searchPlaceholder}
              className="field-input"
            />
          </label>

          <label className="field-shell">
            <span className="field-label">{localeText.courseRuns.filterPackage}</span>
            <select name="package" defaultValue={packageCode} className="field-input">
              <option value="">{localeText.courseRuns.allPackages}</option>
              {packages.map((item) => (
                <option key={item.id} value={item.code}>
                  {item.nameEn || item.nameAr}
                </option>
              ))}
            </select>
          </label>

          <label className="field-shell">
            <span className="field-label">{localeText.courseRuns.filterStatus}</span>
            <select name="status" defaultValue={statusFilter} className="field-input">
              <option value="">{localeText.courseRuns.allStatuses}</option>
              {Object.entries(localeText.courseRunStatuses).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row xl:items-end">
            <button type="submit" className="primary-button w-full sm:w-auto">
              {localeText.courseRuns.applyFilters}
            </button>
            <Link href="/course-runs" className="secondary-button w-full sm:w-auto">
              {localeText.courseRuns.resetFilters}
            </Link>
          </div>
        </form>

        {prioritizedRuns.length === 0 ? (
          <div className="jawraa-subcard mt-6 border-dashed px-5 py-8">
            <h4 className="text-lg font-semibold text-[var(--ink-strong)]">
              {localeText.courseRuns.noRunsTitle}
            </h4>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              {localeText.courseRuns.noRunsDescription}
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{localeText.courseRuns.runCode}</th>
                  <th>{localeText.courseRuns.packageName}</th>
                  <th>{localeText.courseRuns.courseName}</th>
                  <th>{localeText.courseRuns.status}</th>
                  <th>{localeText.courseRuns.dates}</th>
                  <th>{localeText.courseRuns.mode}</th>
                  <th>{localeText.courseRuns.seats}</th>
                </tr>
              </thead>
              <tbody>
                {prioritizedRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="cursor-pointer transition hover:bg-white"
                    onClick={undefined}
                  >
                    <td className="latin-cell">
                      <Link
                        href={`/course-runs/${run.id}`}
                        className="block w-full font-semibold text-[var(--brand-ink)] no-underline"
                      >
                        {run.runCode}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/course-runs/${run.id}`} className="block w-full no-underline">
                        {run.course.package.nameEn || run.course.package.nameAr}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/course-runs/${run.id}`} className="block w-full no-underline">
                        {run.course.nameEn || run.course.nameAr}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/course-runs/${run.id}`} className="block w-full no-underline">
                        <span className="status-pill">
                          {localeText.courseRunStatuses[run.status]}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Link href={`/course-runs/${run.id}`} className="block w-full no-underline">
                        {formatDateRange(
                          run.startDate,
                          run.endDate,
                          numberLocale,
                          localeText.courseRuns.noDates,
                        )}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/course-runs/${run.id}`} className="block w-full no-underline">
                        {localeText.deliveryModes[run.deliveryMode]}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/course-runs/${run.id}`} className="block w-full no-underline">
                        {run.plannedSeats !== null
                          ? formatNumber(run.plannedSeats, numberLocale)
                          : "-"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openPanel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,25,35,0.55)] p-4">
          <div className="jawraa-card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{localeText.courseRuns.createTitle}</p>
                <h3 className="section-title">{uiText.toggleButton}</h3>
              </div>
              <Link href="/course-runs" className="secondary-button">
                {uiText.close}
              </Link>
            </div>

            <p className="section-copy">{localeText.courseRuns.createDescription}</p>

            <form action={createCourseRun} className="mt-6 space-y-4">
              <label className="field-shell">
                <span className="field-label">{localeText.courseRuns.course}</span>
                <select name="courseId" className="field-input" defaultValue="">
                  <option value="" disabled>
                    {localeText.courseRuns.selectCourse}
                  </option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.courseCode} | {course.nameEn || course.nameAr} |{" "}
                      {course.package.nameEn || course.package.nameAr}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-shell">
                  <span className="field-label">{localeText.courseRuns.deliveryMode}</span>
                  <select
                    name="deliveryMode"
                    className="field-input"
                    defaultValue={DeliveryMode.IN_PERSON}
                  >
                    {Object.entries(localeText.deliveryModes).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell">
                  <span className="field-label">{localeText.courseRuns.status}</span>
                  <select
                    name="status"
                    className="field-input"
                    defaultValue={CourseRunStatus.PLANNED}
                  >
                    {Object.entries(localeText.courseRunStatuses).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-shell">
                  <span className="field-label">{localeText.courseRuns.startDate}</span>
                  <input type="date" name="startDate" className="field-input" />
                </label>

                <label className="field-shell">
                  <span className="field-label">{localeText.courseRuns.endDate}</span>
                  <input type="date" name="endDate" className="field-input" />
                </label>
              </div>

              <label className="field-shell">
                <span className="field-label">{localeText.courseRuns.plannedSeats}</span>
                <input
                  type="number"
                  name="plannedSeats"
                  min="0"
                  step="1"
                  className="field-input"
                />
              </label>

              <label className="field-shell">
                <span className="field-label">{localeText.courseRuns.notes}</span>
                <textarea
                  name="notes"
                  rows={4}
                  placeholder={localeText.courseRuns.notesPlaceholder}
                  className="field-input min-h-[7rem] resize-y"
                />
              </label>

              <button type="submit" className="primary-button w-full sm:w-auto">
                {localeText.courseRuns.createAction}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RunMetric({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <article className="jawraa-card p-5">
      <p className="text-sm font-medium text-[var(--ink-soft)]">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--ink-strong)]">{value}</p>
    </article>
  );
}
