import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { InstantSearchField } from "@/components/instant-search-field";
import { db } from "@/lib/db";
import { getLocale, t } from "@/lib/locale";
import { formatPurchaseOrderCode, formatPurchaseOrderTitle } from "@/lib/purchase-order";
import {
  createProjectScope,
  deleteProjectScope,
  updateProjectScope,
} from "@/app/project-structure/actions";
import {
  canCreateOperationalData,
  canEditOperationalData,
  canViewFinancials,
  getCurrentPlatformRole,
  isCustomerCapacityOnly,
} from "@/lib/permissions";

type ProjectStructurePageProps = {
  searchParams?: Promise<{
    q?: string;
    courseQ?: string;
    page?: string;
  }>;
};

const PURCHASE_ORDERS_PAGE_SIZE = 10;

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatCurrency(value: Prisma.Decimal | null | undefined, locale: string) {
  if (!value) return "-";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function progressValue(value: Prisma.Decimal | null | undefined) {
  return value ? Number(value) : 0;
}

function formatInputDate(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function normalizeSearch(value?: string) {
  return value?.trim() || "";
}

function normalizePage(value?: string) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function purchaseOrdersPageHref(page: number, poSearch: string, courseSearch: string) {
  const query = new URLSearchParams();
  if (poSearch) query.set("q", poSearch);
  if (courseSearch) query.set("courseQ", courseSearch);
  if (page > 1) query.set("page", String(page));
  const queryString = query.toString();
  return queryString ? `/pos?${queryString}` : "/pos";
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

export default async function ProjectStructurePage({ searchParams }: ProjectStructurePageProps) {
  const locale = await getLocale();
  const localeText = t(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";
  const params = (await searchParams) ?? {};
  const poSearch = normalizeSearch(params.q);
  const poSearchKey = poSearch.toLowerCase();
  const courseSearch = normalizeSearch(params.courseQ);
  const requestedPage = normalizePage(params.page);
  const platformRole = await getCurrentPlatformRole();
  const canCreate = canCreateOperationalData(platformRole);
  const canEdit = canEditOperationalData(platformRole);
  const canSeeFinancials = canViewFinancials(platformRole);

  if (isCustomerCapacityOnly(platformRole)) {
    redirect("/");
  }

  const scopes = await db.projectScope.findMany({
    orderBy: { code: "asc" },
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
            },
          },
          courseRuns: {
            select: { confirmedSeats: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  const allCourses = await db.course.findMany({
    where: courseSearch
      ? {
          OR: [
            { courseCode: { contains: courseSearch, mode: "insensitive" } },
            { nameAr: { contains: courseSearch, mode: "insensitive" } },
            { nameEn: { contains: courseSearch, mode: "insensitive" } },
            { package: { code: { contains: courseSearch, mode: "insensitive" } } },
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
  });

  const totals = scopes.reduce(
    (summary, scope) => {
      summary.packages += scope.packages.length;
      summary.courses += scope.selectedCourses.length;
      summary.budget += Number(scope.budgetAmount ?? 0);
      summary.invoiced += Number(scope.invoicedAmount ?? 0);
      return summary;
    },
    { packages: 0, courses: 0, budget: 0, invoiced: 0 },
  );
  const filteredScopes = scopes.filter((scope) => {
    if (!poSearchKey) return true;
    return [
      formatPurchaseOrderCode(scope.code, locale),
      formatPurchaseOrderTitle(scope, locale),
      scope.description,
      scope.region,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(poSearchKey);
  });
  const totalScopePages = Math.max(1, Math.ceil(filteredScopes.length / PURCHASE_ORDERS_PAGE_SIZE));
  const safeScopePage = Math.min(requestedPage, totalScopePages);
  const visibleScopes = filteredScopes.slice(
    (safeScopePage - 1) * PURCHASE_ORDERS_PAGE_SIZE,
    safeScopePage * PURCHASE_ORDERS_PAGE_SIZE,
  );

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{localeText.projectScopes.title}</p>
            <h2 className="section-title">{localeText.projectScopes.title}</h2>
            <p className="section-copy">
              {localeText.projectScopes.description}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {canCreate ? (
              <a href="#add-project-scope" className="primary-button">
                {localeText.projectScopes.addScope}
              </a>
            ) : null}
          <Link href="/trainings" className="secondary-button">
            {localeText.projectScopes.activeRuns}
          </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title={localeText.projectScopes.totalProjectScopes} value={formatNumber(scopes.length, numberLocale)} />
        <MetricCard title={localeText.projectScopes.packages} value={formatNumber(totals.packages, numberLocale)} />
        <MetricCard title={localeText.projectScopes.courses} value={formatNumber(totals.courses, numberLocale)} />
        {canSeeFinancials ? (
          <MetricCard
            title={localeText.projectScopes.budget}
            value={formatCurrency(new Prisma.Decimal(totals.budget), numberLocale)}
          />
        ) : null}
      </section>

      {canCreate ? (
        <section id="add-project-scope" className="panel-surface">
        <div className="mb-5">
          <p className="eyebrow">{localeText.projectScopes.addScope}</p>
          <h2 className="section-title">{localeText.projectScopes.addScope}</h2>
        </div>
        <form className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="field-shell">
            <span className="field-label">{localeText.projectScopes.searchCourses}</span>
            <input
              name="courseQ"
              type="search"
              className="field-input"
              defaultValue={courseSearch}
              placeholder={localeText.projectScopes.searchCoursesPlaceholder}
            />
          </label>
          <button type="submit" className="primary-button self-end">
            {localeText.projectScopes.applySearch}
          </button>
          <Link href="/pos#add-project-scope" className="secondary-button self-end">
            {localeText.projectScopes.clearSearch}
          </Link>
        </form>
        <form action={createProjectScope} className="grid gap-4 lg:grid-cols-2">
          <label className="field-shell">
            <span className="field-label">{localeText.projectScopes.code}</span>
            <input name="code" className="field-input" required />
          </label>
          <label className="field-shell">
            <span className="field-label">{localeText.projectScopes.status}</span>
            <select name="status" className="field-input" defaultValue="ACTIVE">
              <option value="ACTIVE">{localeText.projectScopes.active}</option>
              <option value="INACTIVE">{localeText.projectScopes.inactive}</option>
            </select>
          </label>
          <label className="field-shell">
            <span className="field-label">{localeText.projectScopes.nameAr}</span>
            <input name="nameAr" className="field-input" required dir="rtl" />
          </label>
          <label className="field-shell">
            <span className="field-label">{localeText.projectScopes.nameEn}</span>
            <input name="nameEn" className="field-input" required dir="ltr" />
          </label>
          <label className="field-shell">
            <span className="field-label">{localeText.projectScopes.region}</span>
            <input name="region" className="field-input" />
          </label>
          <label className="field-shell">
            <span className="field-label">{localeText.projectScopes.file}</span>
            <input
              name="file"
              type="file"
              className="field-input"
              accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.webp,.zip"
            />
          </label>
          <label className="field-shell">
            <span className="field-label">{localeText.projectScopes.startDate}</span>
            <input name="startDate" type="date" className="field-input" />
          </label>
          <label className="field-shell">
            <span className="field-label">{localeText.projectScopes.expectedEndDate}</span>
            <input name="expectedEndDate" type="date" className="field-input" />
          </label>
          <label className="field-shell lg:col-span-2">
            <span className="field-label">{localeText.projectScopes.descriptionLabel}</span>
            <textarea name="description" rows={3} className="field-input min-h-[6rem] resize-y" />
          </label>
          <label className="field-shell lg:col-span-2">
            <span className="field-label">{localeText.projectScopes.notes}</span>
            <textarea name="notes" rows={3} className="field-input min-h-[6rem] resize-y" />
          </label>
          <fieldset className="field-shell lg:col-span-2">
            <legend className="field-label">{localeText.projectScopes.bulkCourses}</legend>
            <div className="mt-3 grid max-h-[22rem] gap-3 overflow-y-auto rounded-[8px] border border-[rgba(17,17,17,0.1)] bg-white p-3 md:grid-cols-2 xl:grid-cols-3">
              {allCourses.map((course) => (
                <label key={course.id} className="flex items-start gap-3 rounded-[8px] border border-[rgba(17,17,17,0.08)] p-3 text-sm">
                  <input type="checkbox" name="courseIds" value={course.id} className="mt-1" />
                  <span>
                    <span className="block font-bold text-[var(--ink-strong)]">
                      {course.courseCode}
                    </span>
                    <span className="block leading-6 text-[var(--ink-soft)]">
                      {locale === "ar" ? course.nameAr : course.nameEn || course.nameAr}
                    </span>
                    <span className="latin-chip mt-2">{course.package.code}</span>
                  </span>
                </label>
              ))}
              {allCourses.length === 0 ? (
                <p className="text-sm text-[var(--ink-soft)]">
                  {localeText.projectScopes.noCoursesAvailable}
                </p>
              ) : null}
            </div>
          </fieldset>
          <div className="lg:col-span-2">
            <button type="submit" className="primary-button">
              {localeText.projectScopes.create}
            </button>
          </div>
        </form>
        </section>
      ) : null}

      <section className="grid gap-4">
        <form className="panel-surface grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          {courseSearch ? <input type="hidden" name="courseQ" value={courseSearch} /> : null}
          <InstantSearchField
            label={localeText.common.search}
            defaultValue={poSearch}
            placeholder={localeText.common.searchPlaceholder}
            pageParams={["page"]}
          />
          <Link
            href={courseSearch ? `/pos?courseQ=${encodeURIComponent(courseSearch)}` : "/pos"}
            className="secondary-button self-end"
          >
            {localeText.common.reset}
          </Link>
        </form>
        {visibleScopes.map((scope) => {
          const courseCount = scope.selectedCourses.length;
          const totalEstimatedSeats = scope.selectedCourses.reduce(
            (sum, entry) => sum + (entry.estimatedSeats ?? 0),
            0,
          );
          const totalActualSeats = scope.selectedCourses.reduce(
            (sum, entry) =>
              sum +
              entry.courseRuns.reduce((runSum, run) => runSum + run.confirmedSeats, 0),
            0,
          );
          const actual = progressValue(scope.actualCompletion);

          return (
            <div
              key={scope.id}
              className="panel-surface"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="latin-chip">{formatPurchaseOrderCode(scope.code, locale)}</p>
                  <h3 className="mt-4 text-2xl font-semibold text-[var(--ink-strong)]">
                    {formatPurchaseOrderTitle(scope, locale)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                    {scope.description || localeText.projectScopes.description}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <span className="status-pill">{scope.isActive ? localeText.projectScopes.active : localeText.projectScopes.inactive}</span>
                  <Link href={`/pos/${scope.id}`} className="secondary-button">
                    {localeText.projectScopes.viewDetails}
                  </Link>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <InfoBox label={localeText.projectScopes.courses} value={formatNumber(courseCount, numberLocale)} />
                <InfoBox
                  label={localeText.projectScopes.estimatedSeats}
                  value={formatNumber(totalEstimatedSeats, numberLocale)}
                />
                <InfoBox
                  label={localeText.projectScopes.actualSeats}
                  value={formatNumber(totalActualSeats, numberLocale)}
                />
                <InfoBox
                  label={localeText.projectScopes.remainingSeats}
                  value={formatNumber(totalEstimatedSeats - totalActualSeats, numberLocale)}
                />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {scope.selectedCourses.slice(0, 10).map(({ course }) => (
                  <div key={course.id} className="jawraa-subcard p-4">
                    <p className="latin-chip">{course.courseCode}</p>
                    <p className="mt-3 line-clamp-2 text-sm font-semibold text-[var(--ink-strong)]">
                      {course.nameEn || course.nameAr}
                    </p>
                    <p className="mt-2 text-xs text-[var(--ink-soft)]">
                      {localeText.projectScopes.package} {course.package.code}
                    </p>
                  </div>
                ))}
              </div>

              <div className="jawraa-subcard mt-5 p-4">
                <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--ink-soft)]">
                  <span>{localeText.projectScopes.progress}</span>
                  <span>{formatNumber(actual, numberLocale)}%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[var(--surface-soft)]">
                  <div
                    className="h-2 rounded-full bg-[var(--brand-yellow)]"
                    style={{ width: `${Math.min(100, Math.max(0, actual))}%` }}
                  />
                </div>
              </div>
              {canEdit ? (
                <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
                  <details className="jawraa-subcard p-4">
                    <summary className="cursor-pointer text-sm font-bold text-[var(--ink-strong)]">
                      {localeText.projectScopes.editScope}
                    </summary>
                    <form action={updateProjectScope} className="mt-4 grid gap-4 lg:grid-cols-2">
                      <input type="hidden" name="id" value={scope.id} />
                      <label className="field-shell">
                        <span className="field-label">{localeText.projectScopes.code}</span>
                        <input name="code" className="field-input" required defaultValue={scope.code} />
                      </label>
                      <label className="field-shell">
                        <span className="field-label">{localeText.projectScopes.status}</span>
                        <select
                          name="status"
                          className="field-input"
                          defaultValue={scope.isActive ? "ACTIVE" : "INACTIVE"}
                        >
                          <option value="ACTIVE">{localeText.projectScopes.active}</option>
                          <option value="INACTIVE">{localeText.projectScopes.inactive}</option>
                        </select>
                      </label>
                      <label className="field-shell">
                        <span className="field-label">{localeText.projectScopes.nameAr}</span>
                        <input
                          name="nameAr"
                          className="field-input"
                          required
                          dir="rtl"
                          defaultValue={formatPurchaseOrderTitle(scope, "ar")}
                        />
                      </label>
                      <label className="field-shell">
                        <span className="field-label">{localeText.projectScopes.nameEn}</span>
                        <input
                          name="nameEn"
                          className="field-input"
                          required
                          dir="ltr"
                          defaultValue={formatPurchaseOrderTitle(scope, "en")}
                        />
                      </label>
                      <label className="field-shell">
                        <span className="field-label">{localeText.projectScopes.region}</span>
                        <input name="region" className="field-input" defaultValue={scope.region || ""} />
                      </label>
                      <label className="field-shell">
                        <span className="field-label">{localeText.projectScopes.file}</span>
                        <input
                          name="file"
                          type="file"
                          className="field-input"
                          accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.webp,.zip"
                        />
                      </label>
                      <label className="field-shell">
                        <span className="field-label">{localeText.projectScopes.startDate}</span>
                        <input
                          name="startDate"
                          type="date"
                          className="field-input"
                          defaultValue={formatInputDate(scope.startDate)}
                        />
                      </label>
                      <label className="field-shell">
                        <span className="field-label">{localeText.projectScopes.expectedEndDate}</span>
                        <input
                          name="expectedEndDate"
                          type="date"
                          className="field-input"
                          defaultValue={formatInputDate(scope.expectedEndDate)}
                        />
                      </label>
                      <label className="field-shell lg:col-span-2">
                        <span className="field-label">{localeText.projectScopes.descriptionLabel}</span>
                        <textarea
                          name="description"
                          rows={3}
                          className="field-input min-h-[6rem] resize-y"
                          defaultValue={scope.description || ""}
                        />
                      </label>
                      <label className="field-shell lg:col-span-2">
                        <span className="field-label">{localeText.projectScopes.notes}</span>
                        <textarea
                          name="notes"
                          rows={3}
                          className="field-input min-h-[6rem] resize-y"
                          defaultValue={scope.notes || ""}
                        />
                      </label>
                      <div className="lg:col-span-2">
                        <button type="submit" className="primary-button">
                          {localeText.projectScopes.saveScope}
                        </button>
                      </div>
                    </form>
                  </details>
                  <form action={deleteProjectScope} className="self-start">
                    <input type="hidden" name="id" value={scope.id} />
                    <button type="submit" className="secondary-button">
                      {localeText.projectScopes.deleteScope}
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          );
        })}
        {scopes.length > 0 && filteredScopes.length === 0 ? (
          <div className="panel-surface border-dashed text-sm text-[var(--ink-soft)]">
            {localeText.common.noResults}
          </div>
        ) : null}
        {filteredScopes.length > PURCHASE_ORDERS_PAGE_SIZE ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-[var(--ink-soft)]">
              {localeText.pagination.pageIndicator
                .replace("{current}", formatNumber(safeScopePage, numberLocale))
                .replace("{total}", formatNumber(totalScopePages, numberLocale))}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={purchaseOrdersPageHref(1, poSearch, courseSearch)}
                aria-disabled={safeScopePage <= 1}
                className={`pagination-link ${safeScopePage <= 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                {localeText.pagination.first}
              </Link>
              <Link
                href={purchaseOrdersPageHref(Math.max(1, safeScopePage - 1), poSearch, courseSearch)}
                aria-disabled={safeScopePage <= 1}
                className={`pagination-link ${safeScopePage <= 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                {localeText.pagination.previous}
              </Link>
              {paginationPages(safeScopePage, totalScopePages).map((page, index) =>
                page === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                    ...
                  </span>
                ) : (
                  <Link
                    key={page}
                    href={purchaseOrdersPageHref(page, poSearch, courseSearch)}
                    aria-current={page === safeScopePage ? "page" : undefined}
                    className={`pagination-link ${page === safeScopePage ? "pagination-link-active" : ""}`}
                  >
                    {formatNumber(page, numberLocale)}
                  </Link>
                ),
              )}
              <Link
                href={purchaseOrdersPageHref(Math.min(totalScopePages, safeScopePage + 1), poSearch, courseSearch)}
                aria-disabled={safeScopePage >= totalScopePages}
                className={`pagination-link ${safeScopePage >= totalScopePages ? "pointer-events-none opacity-50" : ""}`}
              >
                {localeText.pagination.next}
              </Link>
              <Link
                href={purchaseOrdersPageHref(totalScopePages, poSearch, courseSearch)}
                aria-disabled={safeScopePage >= totalScopePages}
                className={`pagination-link ${safeScopePage >= totalScopePages ? "pointer-events-none opacity-50" : ""}`}
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

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="panel-surface">
      <p className="text-sm font-medium text-[var(--ink-soft)]">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="jawraa-subcard p-4">
      <p className="text-xs font-medium text-[var(--ink-soft)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}
