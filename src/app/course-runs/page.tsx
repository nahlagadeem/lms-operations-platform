import Link from "next/link";
import {
  CourseRunStatus,
  DeliveryMode,
  Prisma,
  TrainingCity,
} from "@prisma/client";
import { createTraining } from "@/app/course-runs/actions";
import { InstantSearchField } from "@/components/instant-search-field";
import { db } from "@/lib/db";
import { getTrainingBusinessFields } from "@/lib/brd-terminology";
import { getLocale, t } from "@/lib/locale";
import { formatPurchaseOrderCode, formatPurchaseOrderTitle } from "@/lib/purchase-order";
import {
  deriveTrainingDisplayStatus,
  simplifiedTrainingStatuses,
  trainingStateFromStatus,
} from "@/lib/training-status";
import {
  canCreateOperationalData,
  canManageFinancialFields,
  getCurrentPlatformRole,
} from "@/lib/permissions";

type CourseRunsPageProps = {
  searchParams?: Promise<{
    q?: string;
    package?: string;
    course?: string;
    po?: string;
    city?: string;
    status?: string;
    panel?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
};

const TRAININGS_PAGE_SIZE = 10;
const trainingListSortKeys = [
  "code",
  "course",
  "estimatedSeats",
  "actualSeats",
  "utilization",
  "location",
  "daysHeld",
  "status",
] as const;

type TrainingListSortKey = (typeof trainingListSortKeys)[number];
type SortDirection = "asc" | "desc";

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function normalizeSingleValue(value?: string) {
  return value?.trim() || "";
}

function normalizePage(value?: string) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function pageText(locale: "en" | "ar") {
  if (locale === "ar") {
    return {
      addButton: "إضافة تدريب جديد",
      toggleButton: "فتح نموذج الإضافة",
      close: "إغلاق",
    };
  }

  return {
    addButton: "Add Training",
    toggleButton: "Add Training",
    close: "Close",
  };
}

function normalizeSortKey(value?: string): TrainingListSortKey {
  return trainingListSortKeys.includes(value as TrainingListSortKey)
    ? (value as TrainingListSortKey)
    : "code";
}

function normalizeSortDirection(value?: string): SortDirection {
  return value === "desc" ? "desc" : "asc";
}

function compareNullableNumber(
  left: number | null,
  right: number | null,
  direction: SortDirection,
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === "asc" ? left - right : right - left;
}

function sortHref(
  params: {
    q: string;
    package: string;
    course: string;
    po: string;
    city: string;
    status: string;
    sort: TrainingListSortKey;
    dir: SortDirection;
  },
  key: TrainingListSortKey,
) {
  const nextDirection =
    params.sort === key && params.dir === "asc" ? "desc" : "asc";
  const query = new URLSearchParams();

  if (params.q) query.set("q", params.q);
  if (params.package) query.set("package", params.package);
  if (params.course) query.set("course", params.course);
  if (params.po) query.set("po", params.po);
  if (params.city) query.set("city", params.city);
  if (params.status) query.set("status", params.status);
  query.set("sort", key);
  query.set("dir", nextDirection);

  return `/trainings?${query.toString()}`;
}

function trainingsPageHref(params: {
  q: string;
  package: string;
  course: string;
  po: string;
  city: string;
  status: string;
  sort: TrainingListSortKey;
  dir: SortDirection;
  page: number;
}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.package) query.set("package", params.package);
  if (params.course) query.set("course", params.course);
  if (params.po) query.set("po", params.po);
  if (params.city) query.set("city", params.city);
  if (params.status) query.set("status", params.status);
  query.set("sort", params.sort);
  query.set("dir", params.dir);
  if (params.page > 1) query.set("page", String(params.page));
  return `/trainings?${query.toString()}`;
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

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDirection,
  query,
}: {
  label: string;
  sortKey: TrainingListSortKey;
  currentSort: TrainingListSortKey;
  currentDirection: SortDirection;
  query: {
    q: string;
    package: string;
    course: string;
    po: string;
    city: string;
    status: string;
  };
}) {
  const isActive = currentSort === sortKey;
  const indicator = isActive ? (currentDirection === "asc" ? " ↑" : " ↓") : "";

  return (
    <th>
      <Link
        href={sortHref({
          ...query,
          sort: currentSort,
          dir: currentDirection,
        }, sortKey)}
        className="inline-flex items-center gap-1 text-inherit no-underline"
      >
        {label}
        <span aria-hidden="true">{indicator}</span>
      </Link>
    </th>
  );
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
  const courseId = normalizeSingleValue(params.course);
  const poId = normalizeSingleValue(params.po);
  const cityFilter = normalizeSingleValue(params.city) as TrainingCity | "";
  const statusFilter = normalizeSingleValue(params.status) as CourseRunStatus | "";
  const sortKey = normalizeSortKey(params.sort);
  const sortDirection = normalizeSortDirection(params.dir);
  const requestedPage = normalizePage(params.page);
  const platformRole = await getCurrentPlatformRole();
  const canCreate = canCreateOperationalData(platformRole);
  const canManageFinancials = canManageFinancialFields(platformRole);

  const whereClause: Prisma.CourseRunWhereInput = {
    courseId: courseId || undefined,
    projectScopeId: poId || undefined,
    city: cityFilter || undefined,
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
          { provider: { nameAr: { contains: searchTerm, mode: "insensitive" } } },
          { provider: { nameEn: { contains: searchTerm, mode: "insensitive" } } },
        ]
      : undefined,
  };

  const [
    totalRuns,
    statusSnapshot,
    packages,
    courses,
    purchaseOrders,
    purchaseOrderCourseEntries,
    vendors,
    courseRuns,
  ] = await Promise.all([
    db.courseRun.count(),
    db.courseRun.findMany({
      select: {
        status: true,
        plannedSeats: true,
        confirmedSeats: true,
        _count: { select: { trainingEvaluations: true } },
      },
    }),
    db.package.findMany({
      select: { id: true, code: true, nameAr: true, nameEn: true },
      orderBy: { code: "asc" },
    }),
    db.course.findMany({
      select: { id: true, courseCode: true, nameAr: true, nameEn: true },
      orderBy: [{ courseCode: "asc" }],
    }),
    db.projectScope.findMany({
      select: { id: true, code: true, name: true, nameAr: true, nameEn: true },
      orderBy: { code: "asc" },
    }),
    db.projectScopeCourse.findMany({
      select: {
        id: true,
        estimatedSeats: true,
        scope: {
          select: { id: true, code: true, name: true, nameAr: true, nameEn: true },
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
      },
      orderBy: [{ scope: { code: "asc" } }, { sortOrder: "asc" }],
    }),
    db.provider.findMany({
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameAr: "asc" },
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
        projectScope: true,
        projectScopeCourse: {
          include: { course: true },
        },
        _count: {
          select: { sessions: true, trainingEvaluations: true },
        },
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const derivedStatusCounts = statusSnapshot.reduce(
    (counts, run) => {
      const status = deriveTrainingDisplayStatus({
        status: run.status,
        plannedSeats: run.plannedSeats,
        confirmedSeats: run.confirmedSeats,
        trainingEvaluationCount: run._count.trainingEvaluations,
      }) as (typeof simplifiedTrainingStatuses)[number];
      counts[status] += 1;
      return counts;
    },
    {
      [CourseRunStatus.PLANNED]: 0,
      [CourseRunStatus.CONFIRMED]: 0,
      [CourseRunStatus.COMPLETED]: 0,
      [CourseRunStatus.CANCELED]: 0,
    } as Record<(typeof simplifiedTrainingStatuses)[number], number>,
  );

  const trainingRows = courseRuns
    .map((run) => {
      const training = getTrainingBusinessFields(run);
      const estimatedSeats = run.plannedSeats;
      const actualSeats = run.confirmedSeats;
      const displayStatus = deriveTrainingDisplayStatus({
        status: run.status,
        plannedSeats: run.plannedSeats,
        confirmedSeats: run.confirmedSeats,
        trainingEvaluationCount: run._count.trainingEvaluations,
      });
      const locationLabel = run.city
        ? localeText.courseRuns.trainingCities[
            run.city as keyof typeof localeText.courseRuns.trainingCities
          ]
        : "-";
      const courseLabel =
        locale === "ar"
          ? run.course.nameAr || run.course.nameEn || run.course.courseCode
          : run.course.nameEn || run.course.nameAr || run.course.courseCode;

      return {
        run,
        training,
        courseLabel,
        estimatedSeats,
        actualSeats,
        utilization:
          estimatedSeats && estimatedSeats > 0 ? (actualSeats / estimatedSeats) * 100 : null,
        locationLabel,
        daysHeld: run.daysHeld ?? run._count.sessions,
        displayStatus,
        statusLabel:
          localeText.courseRunStatuses[
            displayStatus as keyof typeof localeText.courseRunStatuses
          ],
      };
    })
    .filter((row) => !statusFilter || row.displayStatus === statusFilter)
    .sort((left, right) => {
      if (sortKey === "estimatedSeats") {
        return compareNullableNumber(left.estimatedSeats, right.estimatedSeats, sortDirection);
      }

      if (sortKey === "actualSeats") {
        return sortDirection === "asc"
          ? left.actualSeats - right.actualSeats
          : right.actualSeats - left.actualSeats;
      }

      if (sortKey === "utilization") {
        return compareNullableNumber(left.utilization, right.utilization, sortDirection);
      }

      if (sortKey === "daysHeld") {
        return sortDirection === "asc"
          ? left.daysHeld - right.daysHeld
          : right.daysHeld - left.daysHeld;
      }

      const leftValue =
        sortKey === "location"
          ? left.locationLabel
          : sortKey === "course"
            ? left.courseLabel
            : sortKey === "status"
              ? left.statusLabel
            : left.training.trainingCode;
      const rightValue =
        sortKey === "location"
          ? right.locationLabel
          : sortKey === "course"
            ? right.courseLabel
            : sortKey === "status"
              ? right.statusLabel
            : right.training.trainingCode;

      return sortDirection === "asc"
        ? leftValue.localeCompare(rightValue, locale)
        : rightValue.localeCompare(leftValue, locale);
    });
  const totalTrainingPages = Math.max(1, Math.ceil(trainingRows.length / TRAININGS_PAGE_SIZE));
  const safeTrainingPage = Math.min(requestedPage, totalTrainingPages);
  const visibleTrainingRows = trainingRows.slice(
    (safeTrainingPage - 1) * TRAININGS_PAGE_SIZE,
    safeTrainingPage * TRAININGS_PAGE_SIZE,
  );

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">{localeText.courseRuns.eyebrow}</p>
            <h2 className="section-title">{localeText.courseRuns.title}</h2>
            <p className="section-copy">{localeText.courseRuns.description}</p>
          </div>
          {canCreate ? (
            <Link
              href="/trainings?panel=create"
              className="primary-button w-full sm:w-auto"
            >
              {uiText.addButton}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RunMetric title={localeText.courseRuns.totalRuns} value={formatNumber(totalRuns, numberLocale)} />
        <RunMetric title={localeText.courseRunStatuses.PLANNED} value={formatNumber(derivedStatusCounts.PLANNED, numberLocale)} />
        <RunMetric title={localeText.courseRunStatuses.CONFIRMED} value={formatNumber(derivedStatusCounts.CONFIRMED, numberLocale)} />
        <RunMetric title={localeText.courseRunStatuses.COMPLETED} value={formatNumber(derivedStatusCounts.COMPLETED, numberLocale)} />
      </section>

      <section className="panel-surface min-w-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">{localeText.courseRuns.listTitle}</p>
            <h3 className="section-title">{localeText.courseRuns.listTitle}</h3>
            <p className="section-copy">{localeText.courseRuns.listDescription}</p>
          </div>
        </div>

        <form className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_repeat(5,minmax(0,0.8fr))_auto]">
          <InstantSearchField
            label={localeText.courseRuns.search}
            defaultValue={searchTerm}
            placeholder={localeText.common.searchPlaceholder}
            pageParams={["page"]}
          />

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
            <span className="field-label">{localeText.courseRuns.course}</span>
            <select name="course" defaultValue={courseId} className="field-input">
              <option value="">{localeText.courseRuns.allCourses}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.courseCode} | {course.nameEn || course.nameAr}
                </option>
              ))}
            </select>
          </label>

          <label className="field-shell">
            <span className="field-label">{localeText.courseRuns.purchaseOrder}</span>
            <select name="po" defaultValue={poId} className="field-input">
              <option value="">{localeText.courseRuns.allPurchaseOrders}</option>
              {purchaseOrders.map((po) => (
                <option key={po.id} value={po.id}>
                  {formatPurchaseOrderCode(po.code, locale)} | {formatPurchaseOrderTitle(po, locale)}
                </option>
              ))}
            </select>
          </label>

          <label className="field-shell">
            <span className="field-label">{localeText.courseRuns.city}</span>
            <select name="city" defaultValue={cityFilter} className="field-input">
              <option value="">{localeText.courseRuns.allCities}</option>
              {Object.values(TrainingCity).map((city) => (
                <option key={city} value={city}>
                  {
                    localeText.courseRuns.trainingCities[
                      city as keyof typeof localeText.courseRuns.trainingCities
                    ]
                  }
                </option>
              ))}
            </select>
          </label>

          <label className="field-shell">
            <span className="field-label">{localeText.courseRuns.filterStatus}</span>
            <select name="status" defaultValue={statusFilter} className="field-input">
              <option value="">{localeText.courseRuns.allStatuses}</option>
              {simplifiedTrainingStatuses.map((key) => (
                <option key={key} value={key}>
                  {localeText.courseRunStatuses[key]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row xl:items-end">
            <button type="submit" className="primary-button w-full sm:w-auto">
              {localeText.courseRuns.applyFilters}
            </button>
            <Link href="/trainings" className="secondary-button w-full sm:w-auto">
              {localeText.courseRuns.resetFilters}
            </Link>
          </div>
        </form>

        {trainingRows.length === 0 ? (
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
                  <SortHeader
                    label={localeText.courseRuns.runCode}
                    sortKey="code"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    query={{ q: searchTerm, package: packageCode, course: courseId, po: poId, city: cityFilter, status: statusFilter }}
                  />
                  <SortHeader
                    label={localeText.courseRuns.courseName}
                    sortKey="course"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    query={{ q: searchTerm, package: packageCode, course: courseId, po: poId, city: cityFilter, status: statusFilter }}
                  />
                  <SortHeader
                    label={localeText.courseRuns.seats}
                    sortKey="estimatedSeats"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    query={{ q: searchTerm, package: packageCode, course: courseId, po: poId, city: cityFilter, status: statusFilter }}
                  />
                  <SortHeader
                    label={localeText.projectScopes.actualSeats}
                    sortKey="actualSeats"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    query={{ q: searchTerm, package: packageCode, course: courseId, po: poId, city: cityFilter, status: statusFilter }}
                  />
                  <SortHeader
                    label={localeText.courseRuns.utilizationPct}
                    sortKey="utilization"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    query={{ q: searchTerm, package: packageCode, course: courseId, po: poId, city: cityFilter, status: statusFilter }}
                  />
                  <SortHeader
                    label={localeText.courseRuns.city}
                    sortKey="location"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    query={{ q: searchTerm, package: packageCode, course: courseId, po: poId, city: cityFilter, status: statusFilter }}
                  />
                  <SortHeader
                    label={localeText.courseRuns.daysHeld}
                    sortKey="daysHeld"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    query={{ q: searchTerm, package: packageCode, course: courseId, po: poId, city: cityFilter, status: statusFilter }}
                  />
                  <SortHeader
                    label={localeText.courseRuns.status}
                    sortKey="status"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    query={{ q: searchTerm, package: packageCode, course: courseId, po: poId, city: cityFilter, status: statusFilter }}
                  />
                </tr>
              </thead>
              <tbody>
                {visibleTrainingRows.map(({ run, training, courseLabel, estimatedSeats, actualSeats, utilization, locationLabel, daysHeld, displayStatus, statusLabel }) => (
                  <tr
                    key={run.id}
                    className="cursor-pointer transition hover:bg-white"
                    onClick={undefined}
                  >
                    <td className="latin-cell">
                      <Link
                        href={`/trainings/${run.id}`}
                        className="block w-full font-semibold text-[var(--brand-ink)] no-underline"
                      >
                        {training.trainingCode}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/trainings/${run.id}`} className="block w-full no-underline">
                        {courseLabel}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/trainings/${run.id}`} className="block w-full no-underline">
                        {estimatedSeats !== null
                          ? formatNumber(estimatedSeats, numberLocale)
                          : "-"}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/trainings/${run.id}`} className="block w-full no-underline">
                        {formatNumber(actualSeats, numberLocale)}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/trainings/${run.id}`} className="block w-full no-underline">
                        {utilization === null
                          ? "-"
                          : `${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(utilization)}%`}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/trainings/${run.id}`} className="block w-full no-underline">
                        {locationLabel}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/trainings/${run.id}`} className="block w-full no-underline">
                        {formatNumber(daysHeld, numberLocale)}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/trainings/${run.id}`} className="block w-full no-underline">
                        <StatusBadge status={displayStatus} label={statusLabel} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {trainingRows.length > TRAININGS_PAGE_SIZE ? (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[var(--ink-soft)]">
                  {localeText.pagination.pageIndicator
                    .replace("{current}", formatNumber(safeTrainingPage, numberLocale))
                    .replace("{total}", formatNumber(totalTrainingPages, numberLocale))}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={trainingsPageHref({
                      q: searchTerm,
                      package: packageCode,
                      course: courseId,
                      po: poId,
                      city: cityFilter,
                      status: statusFilter,
                      sort: sortKey,
                      dir: sortDirection,
                      page: 1,
                    })}
                    aria-disabled={safeTrainingPage <= 1}
                    className={`pagination-link ${safeTrainingPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.first}
                  </Link>
                  <Link
                    href={trainingsPageHref({
                      q: searchTerm,
                      package: packageCode,
                      course: courseId,
                      po: poId,
                      city: cityFilter,
                      status: statusFilter,
                      sort: sortKey,
                      dir: sortDirection,
                      page: Math.max(1, safeTrainingPage - 1),
                    })}
                    aria-disabled={safeTrainingPage <= 1}
                    className={`pagination-link ${safeTrainingPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.previous}
                  </Link>
                  {paginationPages(safeTrainingPage, totalTrainingPages).map((page, index) =>
                    page === "ellipsis" ? (
                      <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                        ...
                      </span>
                    ) : (
                      <Link
                        key={page}
                        href={trainingsPageHref({
                          q: searchTerm,
                          package: packageCode,
                          course: courseId,
                          po: poId,
                          city: cityFilter,
                          status: statusFilter,
                          sort: sortKey,
                          dir: sortDirection,
                          page,
                        })}
                        aria-current={page === safeTrainingPage ? "page" : undefined}
                        className={`pagination-link ${page === safeTrainingPage ? "pagination-link-active" : ""}`}
                      >
                        {formatNumber(page, numberLocale)}
                      </Link>
                    ),
                  )}
                  <Link
                    href={trainingsPageHref({
                      q: searchTerm,
                      package: packageCode,
                      course: courseId,
                      po: poId,
                      city: cityFilter,
                      status: statusFilter,
                      sort: sortKey,
                      dir: sortDirection,
                      page: Math.min(totalTrainingPages, safeTrainingPage + 1),
                    })}
                    aria-disabled={safeTrainingPage >= totalTrainingPages}
                    className={`pagination-link ${safeTrainingPage >= totalTrainingPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.next}
                  </Link>
                  <Link
                    href={trainingsPageHref({
                      q: searchTerm,
                      package: packageCode,
                      course: courseId,
                      po: poId,
                      city: cityFilter,
                      status: statusFilter,
                      sort: sortKey,
                      dir: sortDirection,
                      page: totalTrainingPages,
                    })}
                    aria-disabled={safeTrainingPage >= totalTrainingPages}
                    className={`pagination-link ${safeTrainingPage >= totalTrainingPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.last}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {openPanel && canCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,25,35,0.55)] p-4">
          <div className="jawraa-card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{localeText.courseRuns.createTitle}</p>
                <h3 className="section-title">{uiText.toggleButton}</h3>
              </div>
              <Link href="/trainings" className="secondary-button">
                {uiText.close}
              </Link>
            </div>

            <p className="section-copy">{localeText.courseRuns.createDescription}</p>

            <form action={createTraining} className="mt-6 space-y-4">
              <label className="field-shell">
                <span className="field-label">{localeText.courseRuns.purchaseOrderCourseEntry}</span>
                <select
                  name="purchaseOrderCourseEntryId"
                  className="field-input"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    {localeText.courseRuns.selectPurchaseOrderCourseEntry}
                  </option>
                  {purchaseOrderCourseEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {formatPurchaseOrderCode(entry.scope.code, locale)} |{" "}
                      {formatPurchaseOrderTitle(entry.scope, locale)} |{" "}
                      {entry.course.courseCode} | {entry.course.nameEn || entry.course.nameAr} |{" "}
                      {localeText.courseRuns.plannedSeats}: {entry.estimatedSeats ?? "-"}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-shell">
                  <span className="field-label">{localeText.courseRuns.vendor}</span>
                  <select name="vendorId" className="field-input" defaultValue="">
                    <option value="">{localeText.courseRuns.chooseVendor}</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.nameEn || vendor.nameAr}
                      </option>
                    ))}
                  </select>
                </label>

                {canManageFinancials ? (
                  <label className="field-shell">
                    <span className="field-label">{localeText.courseRuns.vendorCost}</span>
                    <input
                      type="number"
                      name="vendorCost"
                      step="0.01"
                      min="0"
                      className="field-input"
                    />
                  </label>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-shell">
                  <span className="field-label">{localeText.courseRuns.plannedSeats}</span>
                  <input
                    type="number"
                    name="plannedSeats"
                    min="0"
                    step="1"
                    className="field-input"
                    required
                  />
                </label>

                <label className="field-shell">
                  <span className="field-label">{localeText.courseRuns.city}</span>
                  <select name="city" className="field-input" defaultValue="">
                    <option value="">{localeText.courseRuns.selectCity}</option>
                    {Object.values(TrainingCity).map((city) => (
                      <option key={city} value={city}>
                        {
                          localeText.courseRuns.trainingCities[
                            city as keyof typeof localeText.courseRuns.trainingCities
                          ]
                        }
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell">
                  <span className="field-label">{localeText.courseRuns.daysHeld}</span>
                  <input
                    type="number"
                    name="daysHeld"
                    min="0"
                    step="1"
                    className="field-input"
                  />
                </label>
              </div>

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
                  <span className="field-label">{localeText.courseRuns.trainingState}</span>
                  <select
                    name="trainingState"
                    className="field-input"
                    defaultValue={trainingStateFromStatus(CourseRunStatus.PLANNED)}
                  >
                    <option value="ACTIVE">{localeText.courseRuns.trainingStates.ACTIVE}</option>
                    <option value="CANCELED">{localeText.courseRuns.trainingStates.CANCELED}</option>
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

function StatusBadge({
  status,
  label,
}: {
  status: CourseRunStatus;
  label: string;
}) {
  const tone =
    status === CourseRunStatus.CANCELED
      ? "border-red-200 bg-red-50 text-red-700"
      : status === CourseRunStatus.COMPLETED
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : status === CourseRunStatus.CONFIRMED
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}
