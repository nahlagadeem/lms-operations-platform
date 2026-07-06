import Link from "next/link";
import {
  CourseRunStatus,
  DeliveryMode,
  NominationStatus,
  Prisma,
  TrainingCity,
} from "@prisma/client";
import { createTraining } from "@/app/course-runs/actions";
import { db } from "@/lib/db";
import { getTrainingBusinessFields } from "@/lib/brd-terminology";
import { getLocale, t } from "@/lib/locale";
import { formatPurchaseOrderCode, formatPurchaseOrderTitle } from "@/lib/purchase-order";
import {
  canCreateOperationalData,
  canManageFinancialFields,
  getCurrentPlatformRole,
} from "@/lib/permissions";

type CourseRunsPageProps = {
  searchParams?: Promise<{
    q?: string;
    package?: string;
    status?: string;
    panel?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
};

const TRAININGS_PAGE_SIZE = 10;
const statusGroupsForPlanned = [
  CourseRunStatus.PLANNED,
  CourseRunStatus.APPROVAL_PENDING,
  CourseRunStatus.OPEN_FOR_NOMINATION,
  CourseRunStatus.CONFIRMED,
];

const trainingListSortKeys = [
  "code",
  "estimatedSeats",
  "actualSeats",
  "location",
  "duration",
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
  if (params.status) query.set("status", params.status);
  query.set("sort", key);
  query.set("dir", nextDirection);

  return `/trainings?${query.toString()}`;
}

function trainingsPageHref(params: {
  q: string;
  package: string;
  status: string;
  sort: TrainingListSortKey;
  dir: SortDirection;
  page: number;
}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.package) query.set("package", params.package);
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
  const statusFilter = normalizeSingleValue(params.status) as CourseRunStatus | "";
  const sortKey = normalizeSortKey(params.sort);
  const sortDirection = normalizeSortDirection(params.dir);
  const requestedPage = normalizePage(params.page);
  const platformRole = await getCurrentPlatformRole();
  const canCreate = canCreateOperationalData(platformRole);
  const canManageFinancials = canManageFinancialFields(platformRole);

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
          { provider: { nameAr: { contains: searchTerm, mode: "insensitive" } } },
          { provider: { nameEn: { contains: searchTerm, mode: "insensitive" } } },
        ]
      : undefined,
  };

  const [
    totalRuns,
    plannedRuns,
    ongoingRuns,
    completedRuns,
    packages,
    purchaseOrderCourseEntries,
    vendors,
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
          select: { sessions: true },
        },
        nominations: {
          select: { nominationStatus: true },
        },
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const trainingRows = courseRuns
    .map((run) => {
      const training = getTrainingBusinessFields(run);
      const estimatedSeats = run.projectScopeCourse?.estimatedSeats ?? null;
      const actualSeats = run.nominations.filter(
        (nomination) => nomination.nominationStatus === NominationStatus.CONFIRMED,
      ).length;
      const locationLabel = run.city
        ? localeText.courseRuns.trainingCities[
            run.city as keyof typeof localeText.courseRuns.trainingCities
          ]
        : "-";

      return {
        run,
        training,
        estimatedSeats,
        actualSeats,
        locationLabel,
        duration: run._count.sessions,
      };
    })
    .sort((left, right) => {
      if (sortKey === "estimatedSeats") {
        return compareNullableNumber(left.estimatedSeats, right.estimatedSeats, sortDirection);
      }

      if (sortKey === "actualSeats") {
        return sortDirection === "asc"
          ? left.actualSeats - right.actualSeats
          : right.actualSeats - left.actualSeats;
      }

      if (sortKey === "duration") {
        return sortDirection === "asc"
          ? left.duration - right.duration
          : right.duration - left.duration;
      }

      const leftValue =
        sortKey === "location" ? left.locationLabel : left.training.trainingCode;
      const rightValue =
        sortKey === "location" ? right.locationLabel : right.training.trainingCode;

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
                    query={{ q: searchTerm, package: packageCode, status: statusFilter }}
                  />
                  <SortHeader
                    label={localeText.courseRuns.seats}
                    sortKey="estimatedSeats"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    query={{ q: searchTerm, package: packageCode, status: statusFilter }}
                  />
                  <SortHeader
                    label={localeText.projectScopes.actualSeats}
                    sortKey="actualSeats"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    query={{ q: searchTerm, package: packageCode, status: statusFilter }}
                  />
                  <SortHeader
                    label={localeText.courseRuns.city}
                    sortKey="location"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    query={{ q: searchTerm, package: packageCode, status: statusFilter }}
                  />
                  <SortHeader
                    label={localeText.projectScopes.duration}
                    sortKey="duration"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    query={{ q: searchTerm, package: packageCode, status: statusFilter }}
                  />
                </tr>
              </thead>
              <tbody>
                {visibleTrainingRows.map(({ run, training, estimatedSeats, actualSeats, locationLabel, duration }) => (
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
                        {locationLabel}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/trainings/${run.id}`} className="block w-full no-underline">
                        {formatNumber(duration, numberLocale)}
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
