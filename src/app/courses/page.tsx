import Link from "next/link";
import { ActiveStatus, DeliveryType, Prisma } from "@prisma/client";
import { InstantSearchField } from "@/components/instant-search-field";
import { db } from "@/lib/db";
import { getDirection, getLocale, t } from "@/lib/locale";
import { formatPackageDisplayName } from "@/lib/package-display";
import {
  courseDisplayName,
  loadCourseCatalogRows,
} from "@/server/services/catalog-table-service";

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

function formatDurationLabel(
  days: number | null,
  hours: number | null,
  localeText: ReturnType<typeof t>,
  locale: string,
) {
  const dayLabel = locale === "ar" ? localeText.units.day : localeText.units.day;
  const daysLabel = locale === "ar" ? localeText.units.days : localeText.units.days;
  const hourLabel = locale === "ar" ? localeText.units.hour : localeText.units.hour;
  const hoursLabel = locale === "ar" ? localeText.units.hours : localeText.units.hours;
  const parts: string[] = [];

  if (days) {
    parts.push(`${days} ${days === 1 ? dayLabel : daysLabel}`);
  }

  if (hours) {
    parts.push(`${hours} ${hours === 1 ? hourLabel : hoursLabel}`);
  }

  return parts.length > 0 ? parts.join(" / ") : localeText.courses.unspecified;
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
  const visibleCourses = (
    await loadCourseCatalogRows(locale, { activeOnly: true })
  )
    .filter((course) => {
      if (packageCode && course.packageCode !== packageCode) {
        return false;
      }

      if (deliveryType && course.deliveryType !== deliveryType) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      return [
        course.courseCode,
        course.nameAr,
        course.nameEn,
        course.packageCode,
        course.packageDisplayName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    });

  const pagedCourses = visibleCourses.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const startIndex = totalCourses === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(safePage * PAGE_SIZE, totalCourses);

  return (
    <div className="space-y-6">
      <section className="panel-surface min-w-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">{localeText.courses.eyebrow}</p>
            <h2 className="section-title">{localeText.courses.title}</h2>
            <p className="section-copy">{localeText.courses.description}</p>
          </div>
          <Link href="/packages" className="action-link">
            {localeText.courses.backToPackages}
          </Link>
        </div>

        <form className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_0.8fr_0.8fr_auto_auto]">
          <InstantSearchField
            label={localeText.courses.search}
            defaultValue={searchTerm}
            placeholder={localeText.common.searchPlaceholder}
            pageParams={["page"]}
          />

          <label className="field-shell">
            <span className="field-label">{localeText.courses.package}</span>
            <select name="package" defaultValue={packageCode} className="field-input">
              <option value="">{localeText.courses.allPackages}</option>
              {packages.map((item) => {
                return (
                  <option key={item.id} value={item.code}>
                    {formatPackageDisplayName(item, locale)}
                  </option>
                );
              })}
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

          <Link
            href={`/api/courses/export${searchTerm || packageCode || deliveryType ? `?${new URLSearchParams({
              ...(searchTerm ? { q: searchTerm } : {}),
              ...(packageCode ? { package: packageCode } : {}),
              ...(deliveryType ? { type: deliveryType } : {}),
            }).toString()}` : ""}`}
            className="secondary-button w-full sm:w-auto self-end"
          >
            {localeText.courses.export}
          </Link>
        </form>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--ink-strong)]">
              {localeText.courses.listTitle}
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

        {pagedCourses.length === 0 ? (
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
                  <th>{localeText.courses.course}</th>
                  <th>{localeText.courses.package}</th>
                  <th>{localeText.courses.estimatedSeats}</th>
                  <th>{localeText.courses.actualSeats}</th>
                  <th>{localeText.courses.remainingSeats}</th>
                  <th>{localeText.courses.fulfillmentPct}</th>
                  <th>{localeText.courses.linkedTrainings}</th>
                  <th>{localeText.courses.duration}</th>
                  <th>{localeText.courses.details}</th>
                </tr>
              </thead>
              <tbody>
                {pagedCourses.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                        <div>
                          <p className="font-semibold text-[var(--ink-strong)]">
                            {courseDisplayName(course, locale)}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                        {course.packageDisplayName}
                      </Link>
                    </td>
                    <td className="latin-cell">
                      <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                        {formatNumber(course.estimatedSeats, numberLocale)}
                      </Link>
                    </td>
                    <td className="latin-cell">
                      <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                        {formatNumber(course.actualSeats, numberLocale)}
                      </Link>
                    </td>
                    <td className="latin-cell">
                      <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                        {formatNumber(course.remainingSeats, numberLocale)}
                      </Link>
                    </td>
                    <td className="latin-cell">
                      <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                        {formatNumber(course.fulfillmentPct, numberLocale)}%
                      </Link>
                    </td>
                    <td className="latin-cell">
                      <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                        {formatNumber(course.linkedTrainingsCount, numberLocale)}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                        {formatDurationLabel(course.durationDays, course.durationHours, localeText, locale)}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/courses/${course.id}`} className="secondary-button inline-flex">
                        {localeText.courses.details}
                      </Link>
                    </td>
                  </tr>
                ))}
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

              {paginationPages(safePage, totalPages).map((pageNumber, index) => {
                const previousPage = paginationPages(safePage, totalPages)[index - 1];
                const showEllipsis =
                  previousPage !== undefined && pageNumber !== "ellipsis" && typeof previousPage === "number"
                    ? pageNumber - previousPage > 1
                    : false;

                return (
                  <div key={`${pageNumber}-${index}`} className="flex items-center gap-2">
                    {showEllipsis ? <span className="pagination-ellipsis">...</span> : null}
                    {pageNumber === "ellipsis" ? null : (
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
                    )}
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
