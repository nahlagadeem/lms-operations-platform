import Link from "next/link";
import { ActiveStatus, DeliveryType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getDirection, getLocale, Locale, t } from "@/lib/locale";
import {
  canViewFinancials,
  getCurrentPlatformRole,
  isCustomerCapacityOnly,
} from "@/lib/permissions";

const PAGE_SIZE = 10;

type CoursesPageProps = {
  searchParams?: Promise<{
    q?: string;
    package?: string;
    type?: string;
    page?: string;
  }>;
};

function normalizeSingleValue(value?: string) {
  return value?.trim() || "";
}

function normalizePage(value?: string) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function buildUrl(params: {
  q?: string;
  package?: string;
  type?: string;
  page?: number;
}) {
  const search = new URLSearchParams();

  if (params.q) {
    search.set("q", params.q);
  }

  if (params.package) {
    search.set("package", params.package);
  }

  if (params.type) {
    search.set("type", params.type);
  }

  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }

  const query = search.toString();
  return query ? `/courses?${query}` : "/courses";
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatCurrency(
  value: Prisma.Decimal | null | undefined,
  currencyCode: string,
  locale: string,
  unavailableLabel: string,
) {
  if (!value) {
    return unavailableLabel;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDuration(
  days: number | null,
  hours: number | null,
  locale: Locale,
  labels: {
    unspecified: string;
    day: string;
    days: string;
    hour: string;
    hours: string;
  },
) {
  const parts: string[] = [];

  if (days) {
    parts.push(`${days} ${days === 1 ? labels.day : labels.days}`);
  }

  if (hours) {
    parts.push(`${hours} ${hours === 1 ? labels.hour : labels.hours}`);
  }

  if (parts.length === 0) {
    return labels.unspecified;
  }

  return locale === "ar" ? parts.join(" / ") : parts.join(" / ");
}

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const locale = await getLocale();
  const localeText = t(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";
  const params = (await searchParams) ?? {};
  const searchTerm = normalizeSingleValue(params.q);
  const packageCode = normalizeSingleValue(params.package);
  const deliveryType = normalizeSingleValue(params.type) as DeliveryType | "";
  const currentPage = normalizePage(params.page);
  const platformRole = await getCurrentPlatformRole();
  const canSeeFinancials = canViewFinancials(platformRole);
  const customerOnly = isCustomerCapacityOnly(platformRole);

  const whereClause: Prisma.CourseWhereInput = {
    activeStatus: ActiveStatus.ACTIVE,
    package: packageCode ? { code: packageCode } : undefined,
    deliveryType: deliveryType || undefined,
    OR: searchTerm
      ? [
          { nameAr: { contains: searchTerm, mode: "insensitive" } },
          { nameEn: { contains: searchTerm, mode: "insensitive" } },
          { courseCode: { contains: searchTerm, mode: "insensitive" } },
          { description: { contains: searchTerm, mode: "insensitive" } },
        ]
      : undefined,
  };

  const [packages, totalCourses] = await Promise.all([
    db.package.findMany({
      select: {
        id: true,
        code: true,
        nameAr: true,
        nameEn: true,
      },
      orderBy: { code: "asc" },
    }),
    db.course.count({
      where: whereClause,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCourses / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const courses = await db.course.findMany({
    where: whereClause,
    include: {
      package: {
        select: {
          code: true,
          nameAr: true,
          nameEn: true,
        },
      },
      category: {
        select: {
          nameAr: true,
          nameEn: true,
        },
      },
      pricingRecords: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ package: { code: "asc" } }, { courseCode: "asc" }],
    skip: (safePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const startIndex = totalCourses === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(safePage * PAGE_SIZE, totalCourses);
  const paginationPages = Array.from(
    { length: totalPages },
    (_, index) => index + 1,
  ).filter((pageNumber) => {
    if (totalPages <= 7) {
      return true;
    }

    return (
      pageNumber === 1 ||
      pageNumber === totalPages ||
      Math.abs(pageNumber - safePage) <= 1
    );
  });

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">{localeText.courses.eyebrow}</p>
            <h2 className="section-title">{localeText.courses.title}</h2>
            <p className="section-copy">{localeText.courses.description}</p>
          </div>
          <Link href="/packages" className="action-link">
            {localeText.courses.backToPackages}
          </Link>
        </div>

        {!customerOnly ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Link href="/vendors" className="jawraa-subcard block p-4 transition hover:border-[var(--brand-yellow-strong)] hover:bg-[var(--brand-yellow-soft)]">
              <p className="font-semibold text-[var(--ink-strong)]">
                {localeText.courses.trainingProviders}
              </p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                {localeText.courses.relatedManagementDescription}
              </p>
            </Link>
            <Link href="/locations" className="jawraa-subcard block p-4 transition hover:border-[var(--brand-yellow-strong)] hover:bg-[var(--brand-yellow-soft)]">
              <p className="font-semibold text-[var(--ink-strong)]">
                {localeText.courses.locations}
              </p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                {localeText.courses.relatedManagementDescription}
              </p>
            </Link>
          </div>
        ) : null}

        <form className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
          <label className="field-shell">
            <span className="field-label">{localeText.courses.search}</span>
            <input
              type="search"
              name="q"
              defaultValue={searchTerm}
              placeholder={localeText.common.searchPlaceholder}
              className="field-input"
            />
          </label>

          <label className="field-shell">
            <span className="field-label">{localeText.courses.package}</span>
            <select name="package" defaultValue={packageCode} className="field-input">
              <option value="">{localeText.courses.allPackages}</option>
              {packages.map((item) => (
                <option key={item.id} value={item.code}>
                  {item.nameEn || item.nameAr}
                </option>
              ))}
            </select>
          </label>

          <label className="field-shell">
            <span className="field-label">{localeText.courses.deliveryType}</span>
            <select name="type" defaultValue={deliveryType} className="field-input">
              <option value="">{localeText.courses.allTypes}</option>
              {Object.entries(localeText.deliveryTypes).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row xl:items-end">
            <button type="submit" className="primary-button w-full sm:w-auto">
              {localeText.courses.apply}
            </button>
            <Link href="/courses" className="secondary-button w-full sm:w-auto">
              {localeText.courses.reset}
            </Link>
          </div>
        </form>
      </section>

      <section className="panel-surface">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--ink-strong)]">
              {localeText.courses.results}
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              {totalCourses > 0
                ? `${localeText.courses.showing} ${formatNumber(startIndex, numberLocale)} ${localeText.courses.to} ${formatNumber(endIndex, numberLocale)} ${localeText.courses.fromTotal} ${formatNumber(totalCourses, numberLocale)}`
                : localeText.courses.noResults}
            </p>
          </div>
          <div className="rounded-full border border-[var(--brand-yellow)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink-soft)]">
            {localeText.courses.page} {formatNumber(safePage, numberLocale)} {localeText.courses.of} {formatNumber(totalPages, numberLocale)}
          </div>
        </div>

        {courses.length === 0 ? (
          <div className="jawraa-subcard border-dashed px-5 py-8 text-center">
            <p className="text-lg font-semibold text-[var(--ink-strong)]">
              {localeText.courses.noResults}
            </p>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              {localeText.courses.filterSummary}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{localeText.courses.code}</th>
                  <th>{localeText.courses.name}</th>
                  <th>{localeText.courses.package}</th>
                  <th>{localeText.courses.category}</th>
                  <th>{localeText.courses.type}</th>
                  <th>{localeText.courses.duration}</th>
                  {canSeeFinancials ? <th>{localeText.courses.finalPrice}</th> : null}
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => {
                  const latestPricing = course.pricingRecords[0];
                  const durationLabel = formatDuration(
                    course.defaultDurationDays,
                    course.defaultDurationHours,
                    locale,
                    {
                      unspecified: localeText.courses.unspecified,
                      day: localeText.units.day,
                      days: localeText.units.days,
                      hour: localeText.units.hour,
                      hours: localeText.units.hours,
                    },
                  );

                  return (
                    <tr
                      key={course.id}
                      className="cursor-pointer transition hover:bg-white"
                    >
                      <td className="latin-cell">
                        <Link
                          href={`/courses/${course.id}`}
                          className="block w-full font-semibold text-[var(--brand-ink)] no-underline"
                        >
                          {course.courseCode}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                          <div>
                            <p className="font-semibold text-[var(--ink-strong)]">
                              {course.nameEn || course.nameAr}
                            </p>
                            {course.description ? (
                              <p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">
                                {course.description}
                              </p>
                            ) : null}
                          </div>
                        </Link>
                      </td>
                      <td>
                        <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                          {course.package.nameEn || course.package.nameAr}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                          {course.category.nameEn || course.category.nameAr}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                          {localeText.deliveryTypes[course.deliveryType]}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                          {durationLabel}
                        </Link>
                      </td>
                      {canSeeFinancials ? (
                        <td>
                          <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                            {formatCurrency(
                              latestPricing?.finalUnitPriceWithoutTax,
                              latestPricing?.currencyCode || "SAR",
                              numberLocale,
                              localeText.courses.unavailable,
                            )}
                          </Link>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div
            className="mt-6 flex flex-wrap items-center justify-between gap-3"
            dir={getDirection(locale)}
          >
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildUrl({
                  q: searchTerm,
                  package: packageCode,
                  type: deliveryType,
                  page: Math.max(1, safePage - 1),
                })}
                aria-disabled={safePage <= 1}
                className={`secondary-button w-full sm:w-auto ${safePage <= 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                {localeText.courses.previous}
              </Link>

              {paginationPages.map((pageNumber, index) => {
                const previousPage = paginationPages[index - 1];
                const showEllipsis =
                  previousPage !== undefined && pageNumber - previousPage > 1;

                return (
                  <div key={pageNumber} className="flex items-center gap-2">
                    {showEllipsis ? (
                      <span className="pagination-ellipsis">...</span>
                    ) : null}
                    <Link
                      href={buildUrl({
                        q: searchTerm,
                        package: packageCode,
                        type: deliveryType,
                        page: pageNumber,
                      })}
                      className={`pagination-link ${pageNumber === safePage ? "pagination-link-active" : ""}`}
                    >
                      {formatNumber(pageNumber, numberLocale)}
                    </Link>
                  </div>
                );
              })}

              <Link
                href={buildUrl({
                  q: searchTerm,
                  package: packageCode,
                  type: deliveryType,
                  page: Math.min(totalPages, safePage + 1),
                })}
                aria-disabled={safePage >= totalPages}
                className={`secondary-button w-full sm:w-auto ${safePage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
              >
                {localeText.courses.next}
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
