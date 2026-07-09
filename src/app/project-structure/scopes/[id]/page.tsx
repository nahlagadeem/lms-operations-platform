import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DocumentEntityType, DocumentType, Prisma } from "@prisma/client";
import { InstantSearchField } from "@/components/instant-search-field";
import { db } from "@/lib/db";
import { getLocale, t } from "@/lib/locale";
import { formatPackageDisplayName } from "@/lib/package-display";
import { formatPurchaseOrderCode, formatPurchaseOrderTitle } from "@/lib/purchase-order";
import {
  canCreateOperationalData,
  canEditOperationalData,
  canViewFinancials,
  getCurrentPlatformRole,
  isCustomerCapacityOnly,
} from "@/lib/permissions";
import { getPoCourseTracking } from "@/server/services/purchase-order-service";
import {
  assignProjectScopeCourses,
  removeProjectScopeCourse,
  updatePurchaseOrderCourseEntryEstimatedSeats,
} from "@/app/project-structure/actions";

type ScopeDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    coursePage?: string;
    trackingPage?: string;
    trackingQ?: string;
    assignQ?: string;
  }>;
};

const COURSES_PER_PAGE = 10;
const TRACKING_ROWS_PER_PAGE = 10;

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function countAssignedPackages(
  selectedCourses: Array<{ course: { package: { id: string } } }>,
) {
  return new Set(selectedCourses.map((selection) => selection.course.package.id)).size;
}

function formatCurrency(value: Prisma.Decimal | null | undefined, locale: string) {
  if (!value) return "-";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatFileSize(bytes: number | null, locale: string) {
  if (!bytes) return "-";

  if (bytes < 1024 * 1024) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
  }

  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}

function documentTypeText() {
  return {
    COURSE_CARD: "Course card",
    PRESENTATION: "Presentation",
    LEARNER_GUIDE: "Learner guide",
    ATTENDANCE_SHEET: "Attendance sheet",
    CERTIFICATE_TEMPLATE: "Certificate template",
    QUALITY_REPORT: "Course report",
    FINAL_REPORT: "Final report",
    PHOTOS_ARCHIVE: "Photos archive",
    OTHER: "Other",
  } as Record<DocumentType, string>;
}

function normalizePage(value?: string) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
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

function normalizeSearch(value?: string) {
  return value?.trim() || "";
}

function buildScopeUrl(
  scopeId: string,
  page: number,
  assignQ?: string,
  trackingPage?: number,
  trackingQ?: string,
) {
  const search = new URLSearchParams();
  if (page > 1) search.set("coursePage", String(page));
  if (trackingPage && trackingPage > 1) {
    search.set("trackingPage", String(trackingPage));
  }
  if (trackingQ) search.set("trackingQ", trackingQ);
  if (assignQ) search.set("assignQ", assignQ);
  const query = search.toString();
  return query ? `/pos/${scopeId}?${query}` : `/pos/${scopeId}`;
}

export default async function ScopeDetailPage({ params, searchParams }: ScopeDetailPageProps) {
  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const locale = await getLocale();
  const localeText = t(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";
  const requestedCoursePage = normalizePage(queryParams.coursePage);
  const requestedTrackingPage = normalizePage(queryParams.trackingPage);
  const trackingSearch = normalizeSearch(queryParams.trackingQ);
  const trackingSearchKey = trackingSearch.toLowerCase();
  const assignSearch = normalizeSearch(queryParams.assignQ);
  const platformRole = await getCurrentPlatformRole();
  const canCreate = canCreateOperationalData(platformRole);
  const canEdit = canEditOperationalData(platformRole);
  const canSeeFinancials = canViewFinancials(platformRole);

  if (isCustomerCapacityOnly(platformRole)) {
    redirect("/");
  }

  const [scope, documents, allCourses, tracking] = await Promise.all([
    db.projectScope.findUnique({
      where: { id },
      include: {
        packages: {
          orderBy: { code: "asc" },
          include: {
            _count: {
              select: { courses: true },
            },
          },
        },
        selectedCourses: {
          include: {
            course: {
              include: {
                package: true,
                category: true,
              },
            },
            _count: { select: { courseRuns: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    db.document.findMany({
      where: {
        entityType: DocumentEntityType.SCOPE,
        entityId: id,
      },
      orderBy: { uploadedAt: "desc" },
    }),
    db.course.findMany({
      where: assignSearch
        ? {
            OR: [
              { courseCode: { contains: assignSearch, mode: "insensitive" } },
              { nameAr: { contains: assignSearch, mode: "insensitive" } },
              { nameEn: { contains: assignSearch, mode: "insensitive" } },
              { package: { code: { contains: assignSearch, mode: "insensitive" } } },
            ],
          }
        : undefined,
      select: {
        id: true,
        courseCode: true,
        nameAr: true,
        nameEn: true,
        package: {
          select: {
            code: true,
          },
        },
      },
      orderBy: [{ package: { code: "asc" } }, { courseCode: "asc" }],
    }),
    getPoCourseTracking(id),
  ]);

  if (!scope) {
    notFound();
  }

  const courseCount = scope.selectedCourses.length;
  const packageCount = countAssignedPackages(scope.selectedCourses);
  const scopeName = formatPurchaseOrderTitle(scope, locale);
  const trackingByEntryId = new Map(
    tracking?.rows.map((row) => [row.purchaseOrderCourseEntryId, row] as const) ?? [],
  );
  const trackingRows = tracking?.rows ?? [];
  const filteredTrackingRows = trackingRows.filter((row) => {
    if (!trackingSearchKey) return true;
    return [
      row.courseCode,
      row.courseName,
      row.packageCode,
      row.packageNameAr,
      row.packageNameEn,
    ]
      .join(" ")
      .toLowerCase()
      .includes(trackingSearchKey);
  });
  const totalTrackingPages = Math.max(1, Math.ceil(filteredTrackingRows.length / TRACKING_ROWS_PER_PAGE));
  const safeTrackingPage = Math.min(requestedTrackingPage, totalTrackingPages);
  const visibleTrackingRows = filteredTrackingRows.slice(
    (safeTrackingPage - 1) * TRACKING_ROWS_PER_PAGE,
    safeTrackingPage * TRACKING_ROWS_PER_PAGE,
  );
  const totalCoursePages = Math.max(1, Math.ceil(scope.selectedCourses.length / COURSES_PER_PAGE));
  const safeCoursePage = Math.min(requestedCoursePage, totalCoursePages);
  const visibleCourses = scope.selectedCourses.slice(
    (safeCoursePage - 1) * COURSES_PER_PAGE,
    safeCoursePage * COURSES_PER_PAGE,
  );
  const selectedCourseIds = new Set(scope.selectedCourses.map((selection) => selection.courseId));
  const visibleAssignableCourseIds = new Set(allCourses.map((course) => course.id));
  const hiddenSelectedCourseIds = Array.from(selectedCourseIds).filter(
    (courseId) => !visibleAssignableCourseIds.has(courseId),
  );

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/pos"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-ink)] hover:underline"
            >
              <span aria-hidden="true">←</span>
              <span>{localeText.projectScopes.backToScopes}</span>
            </Link>
            <p className="eyebrow">{localeText.projectScopes.title}</p>
            <p className="latin-chip mt-1">{formatPurchaseOrderCode(scope.code, locale)}</p>
            <h2 className="section-title">{scopeName}</h2>
            <p className="section-copy">
              {localeText.projectScopes.detailDescription}
            </p>
          </div>
          <span className="status-pill">{scope.isActive ? localeText.projectScopes.active : localeText.projectScopes.inactive}</span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title={localeText.projectScopes.packages} value={formatNumber(packageCount, numberLocale)} />
        <MetricCard title={localeText.projectScopes.courses} value={formatNumber(courseCount, numberLocale)} />
        {canSeeFinancials ? (
          <>
            <MetricCard title={localeText.projectScopes.budget} value={formatCurrency(scope.budgetAmount, numberLocale)} />
            <MetricCard title={localeText.projectScopes.invoiced} value={formatCurrency(scope.invoicedAmount, numberLocale)} />
            <MetricCard title={localeText.projectScopes.collected} value={formatCurrency(scope.collectedAmount, numberLocale)} />
          </>
        ) : null}
      </section>

      {tracking ? (
        <section className="panel-surface">
          <p className="eyebrow">{localeText.projectScopes.trackingTitle}</p>
          <h3 className="section-title">{localeText.projectScopes.trackingTitle}</h3>
          <p className="section-copy">{localeText.projectScopes.trackingDescription}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title={localeText.projectScopes.estimatedSeats}
              value={formatNumber(tracking.summary.estimatedSeats, numberLocale)}
            />
            <MetricCard
              title={localeText.projectScopes.actualSeats}
              value={formatNumber(tracking.summary.actualSeats, numberLocale)}
            />
            <MetricCard
              title={localeText.projectScopes.remainingSeats}
              value={formatNumber(tracking.summary.remainingSeats, numberLocale)}
            />
            <MetricCard
              title={localeText.projectScopes.fulfillmentPct}
              value={`${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(
                tracking.summary.fulfillmentPct,
              )}%`}
            />
          </div>
        </section>
      ) : null}

      {tracking?.rows.length ? (
        <section className="panel-surface">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{localeText.projectScopes.trackingTitle}</p>
              <h3 className="section-title">{localeText.projectScopes.summaryTitle}</h3>
            </div>
          </div>
          <form className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            {safeCoursePage > 1 ? <input type="hidden" name="coursePage" value={safeCoursePage} /> : null}
            {assignSearch ? <input type="hidden" name="assignQ" value={assignSearch} /> : null}
            <InstantSearchField
              name="trackingQ"
              label={localeText.common.search}
              defaultValue={trackingSearch}
              placeholder={localeText.common.searchPlaceholder}
              pageParams={["trackingPage"]}
            />
            <Link
              href={buildScopeUrl(scope.id, safeCoursePage, assignSearch, 1)}
              className="secondary-button self-end"
            >
              {localeText.common.reset}
            </Link>
          </form>
          <div className="mt-5 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{localeText.courseRuns.course}</th>
                  <th>{localeText.projectScopes.package}</th>
                  <th>{localeText.projectScopes.estimatedSeats}</th>
                  <th>{localeText.projectScopes.actualSeats}</th>
                  <th>{localeText.projectScopes.remainingSeats}</th>
                  <th>{localeText.projectScopes.fulfillmentPct}</th>
                  <th>{localeText.projectScopes.linkedTrainings}</th>
                  <th>{localeText.projectScopes.overageShortfallFlag}</th>
                </tr>
              </thead>
              <tbody>
                {visibleTrackingRows.map((row) => (
                  <tr key={row.purchaseOrderCourseEntryId}>
                    <td>
                      <Link href={`/courses/${row.courseId}`} className="font-semibold text-[var(--brand-ink)] hover:underline">
                        {row.courseCode} | {row.courseName}
                      </Link>
                    </td>
                    <td>{formatPackageDisplayName({
                      code: row.packageCode,
                      nameAr: row.packageNameAr,
                      nameEn: row.packageNameEn,
                    }, locale)}</td>
                    <td>{formatNumber(row.estimatedSeats, numberLocale)}</td>
                    <td>{formatNumber(row.actualSeats, numberLocale)}</td>
                    <td>{formatNumber(row.remainingSeats, numberLocale)}</td>
                    <td>
                      {new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(
                        row.fulfillmentPct,
                      )}
                      %
                    </td>
                    <td>
                      {formatNumber(row.linkedTrainingsCount, numberLocale)}
                    </td>
                    <td>
                      {row.overageFlag ? (
                        <span className="status-pill">{localeText.projectScopes.overageFlag}</span>
                      ) : row.shortfallFlag ? (
                        <span className="status-pill">{localeText.projectScopes.shortfallFlag}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredTrackingRows.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--ink-soft)]">
                {localeText.common.noResults}
              </p>
            ) : null}
            {filteredTrackingRows.length > TRACKING_ROWS_PER_PAGE ? (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[var(--ink-soft)]">
                  {localeText.pagination.pageIndicator
                    .replace("{current}", formatNumber(safeTrackingPage, numberLocale))
                    .replace("{total}", formatNumber(totalTrackingPages, numberLocale))}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={buildScopeUrl(scope.id, safeCoursePage, assignSearch, 1, trackingSearch)}
                    aria-disabled={safeTrackingPage <= 1}
                    className={`pagination-link ${safeTrackingPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.first}
                  </Link>
                  <Link
                    href={buildScopeUrl(
                      scope.id,
                      safeCoursePage,
                      assignSearch,
                      Math.max(1, safeTrackingPage - 1),
                      trackingSearch,
                    )}
                    aria-disabled={safeTrackingPage <= 1}
                    className={`pagination-link ${safeTrackingPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.previous}
                  </Link>
                  {paginationPages(safeTrackingPage, totalTrackingPages).map((page, index) =>
                    page === "ellipsis" ? (
                      <span key={`tracking-ellipsis-${index}`} className="pagination-ellipsis">
                        ...
                      </span>
                    ) : (
                      <Link
                        key={page}
                        href={buildScopeUrl(scope.id, safeCoursePage, assignSearch, page, trackingSearch)}
                        aria-current={page === safeTrackingPage ? "page" : undefined}
                        className={`pagination-link ${page === safeTrackingPage ? "pagination-link-active" : ""}`}
                      >
                        {formatNumber(page, numberLocale)}
                      </Link>
                    ),
                  )}
                  <Link
                    href={buildScopeUrl(
                      scope.id,
                      safeCoursePage,
                      assignSearch,
                      Math.min(totalTrackingPages, safeTrackingPage + 1),
                      trackingSearch,
                    )}
                    aria-disabled={safeTrackingPage >= totalTrackingPages}
                    className={`pagination-link ${safeTrackingPage >= totalTrackingPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.next}
                  </Link>
                  <Link
                    href={buildScopeUrl(scope.id, safeCoursePage, assignSearch, totalTrackingPages, trackingSearch)}
                    aria-disabled={safeTrackingPage >= totalTrackingPages}
                    className={`pagination-link ${safeTrackingPage >= totalTrackingPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.last}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-6">
          <div className="panel-surface">
            <p className="eyebrow">{localeText.projectScopes.selectedCourses}</p>
            <h3 className="section-title">
              {localeText.projectScopes.coursesInScope.replace("{scope}", scopeName)}
            </h3>

            <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {visibleCourses.map((entry) => {
                const course = entry.course;
                const trackingRow = trackingByEntryId.get(entry.id);
                return (
                <div
                  key={entry.id}
                  className="jawraa-subcard p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="latin-chip">{course.courseCode}</p>
                      <Link href={`/courses/${course.id}`} className="mt-3 block text-lg font-semibold text-[var(--ink-strong)] hover:underline">
                        {course.nameEn || course.nameAr}
                      </Link>
                      <p className="mt-2 text-xs text-[var(--ink-soft)]">
                        {formatPackageDisplayName(course.package, locale)}
                      </p>
                    </div>
                    <span className="status-pill">{localeText.projectScopes.active}</span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoBox
                      label={localeText.projectScopes.package}
                      value={formatPackageDisplayName(course.package, locale)}
                    />
                    <InfoBox label={localeText.projectScopes.duration} value={course.defaultDurationDays ? `${formatNumber(course.defaultDurationDays, numberLocale)} ${localeText.units.days}` : "-"} />
                    <InfoBox label={localeText.projectScopes.language} value={course.language || "-"} />
                    <InfoBox
                      label={localeText.projectScopes.linkedTrainings}
                      value={formatNumber(entry._count.courseRuns, numberLocale)}
                    />
                  </div>
                  {trackingRow ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoBox
                        label={localeText.projectScopes.estimatedSeats}
                        value={formatNumber(trackingRow.estimatedSeats, numberLocale)}
                      />
                      <InfoBox
                        label={localeText.projectScopes.actualSeats}
                        value={formatNumber(trackingRow.actualSeats, numberLocale)}
                      />
                      <InfoBox
                        label={localeText.projectScopes.remainingSeats}
                        value={formatNumber(trackingRow.remainingSeats, numberLocale)}
                      />
                      <InfoBox
                        label={localeText.projectScopes.fulfillmentPct}
                        value={`${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(
                          trackingRow.fulfillmentPct,
                        )}%`}
                      />
                    </div>
                  ) : null}
                  {trackingRow ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      {trackingRow.overageFlag ? (
                        <span className="status-pill">{localeText.projectScopes.overageFlag}</span>
                      ) : null}
                      {trackingRow.shortfallFlag ? (
                        <span className="status-pill">{localeText.projectScopes.shortfallFlag}</span>
                      ) : null}
                      {trackingRow.zeroActualFlag ? (
                        <span className="status-pill">{localeText.projectScopes.zeroActualFlag}</span>
                      ) : null}
                    </div>
                  ) : null}
                  {canEdit ? (
                    <>
                      <form action={updatePurchaseOrderCourseEntryEstimatedSeats} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                        <input type="hidden" name="purchaseOrderId" value={scope.id} />
                        <input type="hidden" name="purchaseOrderCourseEntryId" value={entry.id} />
                        <label className="field-shell flex-1">
                          <span className="field-label">{localeText.projectScopes.estimatedSeats}</span>
                          <input
                            type="number"
                            name="estimatedSeats"
                            min="0"
                            step="1"
                            className="field-input"
                            defaultValue={entry.estimatedSeats ?? ""}
                          />
                        </label>
                        <button type="submit" className="primary-button">
                          {localeText.buttons.save}
                        </button>
                      </form>
                      <form action={removeProjectScopeCourse} className="mt-4">
                        <input type="hidden" name="scopeId" value={scope.id} />
                        <input type="hidden" name="courseId" value={course.id} />
                        <button type="submit" className="secondary-button">
                          {localeText.projectScopes.unassignCourse}
                        </button>
                      </form>
                    </>
                  ) : null}
                </div>
                );
              })}
            </div>
            {visibleCourses.length === 0 ? (
              <p className="mt-5 text-sm text-[var(--ink-soft)]">
                {localeText.projectScopes.noCourses}
              </p>
            ) : null}
            {scope.selectedCourses.length > COURSES_PER_PAGE ? (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[var(--ink-soft)]">
                  {localeText.pagination.pageIndicator
                    .replace("{current}", formatNumber(safeCoursePage, numberLocale))
                    .replace("{total}", formatNumber(totalCoursePages, numberLocale))}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={buildScopeUrl(scope.id, 1, assignSearch, safeTrackingPage, trackingSearch)}
                    aria-disabled={safeCoursePage <= 1}
                    className={`pagination-link ${safeCoursePage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.first}
                  </Link>
                  <Link
                    href={buildScopeUrl(
                      scope.id,
                      Math.max(1, safeCoursePage - 1),
                      assignSearch,
                      safeTrackingPage,
                      trackingSearch,
                    )}
                    aria-disabled={safeCoursePage <= 1}
                    className={`pagination-link ${safeCoursePage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.previous}
                  </Link>
                  {paginationPages(safeCoursePage, totalCoursePages).map((page, index) =>
                    page === "ellipsis" ? (
                      <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                        ...
                      </span>
                    ) : (
                      <Link
                        key={page}
                        href={buildScopeUrl(scope.id, page, assignSearch, safeTrackingPage, trackingSearch)}
                        aria-current={page === safeCoursePage ? "page" : undefined}
                        className={`pagination-link ${page === safeCoursePage ? "pagination-link-active" : ""}`}
                      >
                        {formatNumber(page, numberLocale)}
                      </Link>
                    ),
                  )}
                  <Link
                    href={buildScopeUrl(
                      scope.id,
                      Math.min(totalCoursePages, safeCoursePage + 1),
                      assignSearch,
                      safeTrackingPage,
                      trackingSearch,
                    )}
                    aria-disabled={safeCoursePage >= totalCoursePages}
                    className={`pagination-link ${safeCoursePage >= totalCoursePages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.next}
                  </Link>
                  <Link
                    href={buildScopeUrl(scope.id, totalCoursePages, assignSearch, safeTrackingPage, trackingSearch)}
                    aria-disabled={safeCoursePage >= totalCoursePages}
                    className={`pagination-link ${safeCoursePage >= totalCoursePages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.last}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          {canCreate ? (
            <div className="panel-surface">
              <p className="eyebrow">{localeText.projectScopes.bulkCourses}</p>
              <h3 className="section-title">{localeText.projectScopes.assignCourses}</h3>
              <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
                <InstantSearchField
                  name="assignQ"
                  label={localeText.projectScopes.searchCourses}
                  defaultValue={assignSearch}
                  placeholder={localeText.projectScopes.searchCoursesPlaceholder}
                  pageParams={["coursePage"]}
                />
                <Link href={`/pos/${scope.id}`} className="secondary-button self-end">
                  {localeText.projectScopes.clearSearch}
                </Link>
              </div>
              <form action={assignProjectScopeCourses} className="mt-5 space-y-4">
                <input type="hidden" name="scopeId" value={scope.id} />
                {hiddenSelectedCourseIds.map((courseId) => (
                  <input key={courseId} type="hidden" name="courseIds" value={courseId} />
                ))}
                <div className="grid max-h-[28rem] gap-3 overflow-y-auto rounded-[8px] border border-[rgba(17,17,17,0.1)] bg-white p-3 md:grid-cols-2">
                  {allCourses.map((course) => (
                    <label key={course.id} className="flex items-start gap-3 rounded-[8px] border border-[rgba(17,17,17,0.08)] p-3 text-sm">
                      <input
                        type="checkbox"
                        name="courseIds"
                        value={course.id}
                        defaultChecked={selectedCourseIds.has(course.id)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block font-bold text-[var(--ink-strong)]">
                          {course.courseCode}
                        </span>
                        <span className="block leading-6 text-[var(--ink-soft)]">
                          {locale === "ar" ? course.nameAr : course.nameEn || course.nameAr}
                        </span>
                        <span className="latin-chip mt-2">
                          {formatPackageDisplayName(course.package, locale)}
                        </span>
                      </span>
                    </label>
                  ))}
                  {allCourses.length === 0 ? (
                    <p className="text-sm text-[var(--ink-soft)]">
                      {localeText.projectScopes.noCoursesAvailable}
                    </p>
                  ) : null}
                </div>
                <button type="submit" className="primary-button">
                  {localeText.projectScopes.saveCourses}
                </button>
              </form>
            </div>
          ) : null}

          <div className="panel-surface">
            <p className="eyebrow">{localeText.projectScopes.documents}</p>
            <h3 className="section-title">{localeText.projectScopes.documents}</h3>
            <p className="section-copy">
              {localeText.projectScopes.uploadDescription}
            </p>

            {canEdit ? (
              <form
                action="/api/project-documents"
                method="post"
                encType="multipart/form-data"
                className="mt-5 space-y-4"
              >
                <input type="hidden" name="entityType" value={DocumentEntityType.SCOPE} />
                <input type="hidden" name="entityId" value={scope.id} />
                <input type="hidden" name="returnPath" value={`/pos/${scope.id}`} />
                <input type="hidden" name="contextLabel" value={`${scopeName} document`} />

                <label className="field-shell">
                  <span className="field-label">{localeText.projectScopes.fileType}</span>
                  <select name="documentType" className="field-input" defaultValue={DocumentType.OTHER}>
                    {Object.entries(documentTypeText()).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell">
                  <span className="field-label">{localeText.projectScopes.uploadFile}</span>
                  <input
                    type="file"
                    name="file"
                    className="field-input"
                    accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.webp,.zip"
                  />
                </label>

                <label className="field-shell">
                  <span className="field-label">{localeText.projectScopes.descriptionNotes}</span>
                  <textarea name="notes" rows={3} className="field-input min-h-[6rem] resize-y" />
                </label>

                <button type="submit" className="primary-button w-full sm:w-auto">
                  {localeText.projectScopes.uploadFile}
                </button>
              </form>
            ) : null}

          <div className="mt-6 space-y-3">
            {documents.length === 0 ? (
              <div className="jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                {localeText.projectScopes.noDocuments}
              </div>
            ) : (
              documents.map((document) => (
                <div key={document.id} className="jawraa-subcard px-4 py-4">
                  <p className="truncate text-sm font-semibold text-[var(--ink-strong)]">
                    {document.originalFileName || document.fileName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink-soft)]">
                    {documentTypeText()[document.documentType]} | {localeText.projectScopes.version} {document.version} | {localeText.projectScopes.fileSize}:{" "}
                    {formatFileSize(document.fileSizeBytes, numberLocale)}
                  </p>
                  {document.notes ? (
                    <p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">{document.notes}</p>
                  ) : null}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Link href={document.fileUrl} className="secondary-button w-full sm:w-auto">
                      {localeText.projectScopes.download}
                    </Link>
                    {canEdit ? (
                      <form action="/api/project-documents/delete" method="post">
                        <input type="hidden" name="documentId" value={document.id} />
                        <input
                          type="hidden"
                          name="returnPath"
                          value={`/pos/${scope.id}`}
                        />
                        <button type="submit" className="secondary-button w-full sm:w-auto">
                          {localeText.projectScopes.deleteFile}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="panel-surface">
      <p className="text-sm font-medium text-[var(--ink-soft)]">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}

function InfoBox({
  title,
  label,
  value,
}: {
  title?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="jawraa-subcard p-4">
      {title ? <p className="text-sm font-semibold text-[var(--ink-strong)]">{title}</p> : null}
      <p className="text-xs font-medium text-[var(--ink-soft)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}
