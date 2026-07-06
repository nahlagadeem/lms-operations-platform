import Link from "next/link";
import { notFound } from "next/navigation";
import { ActiveStatus, DeliveryType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getLocale, t } from "@/lib/locale";
import { canViewFinancials, getCurrentPlatformRole } from "@/lib/permissions";

const PAGE_SIZE = 10;

type PackageDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    q?: string;
    type?: string;
    page?: string;
  }>;
};

function detailText(locale: "en" | "ar") {
  if (locale === "ar") {
    return {
      back: "العودة إلى الحزم",
      title: "تفاصيل الحزمة",
      description: "عرض الدورات المدرجة ضمن هذه الحزمة مع ملخص سريع عن كل دورة.",
      courseList: "الدورات ضمن الحزمة",
      courseCount: "عدد الدورات",
      target: "المستهدف",
      discountedValue: "القيمة بعد الخصم",
      code: "الكود",
      category: "التصنيف",
      type: "النوع",
      duration: "المدة",
      finalPrice: "السعر النهائي",
      search: "بحث",
      searchPlaceholder: "اسم الدورة أو الكود",
      allTypes: "كل الأنواع",
      apply: "تطبيق",
      reset: "إعادة ضبط",
      results: "النتائج الحالية",
      showing: "عرض",
      to: "إلى",
      fromTotal: "من أصل",
      page: "الصفحة",
      of: "من",
      previous: "السابق",
      next: "التالي",
      noDescription: "لا يوجد وصف متاح لهذه الحزمة.",
      unavailable: "غير متوفر",
      unspecified: "غير محدد",
    };
  }

  return {
    back: "Back to packages",
    title: "Package details",
    description: "Review the courses, attendee targets, and planning values for this package.",
    courseList: "Courses in this package",
    courseCount: "Course count",
    target: "Target attendees",
    discountedValue: "Discounted value",
    code: "Code",
    category: "Category",
    type: "Type",
    duration: "Duration",
    finalPrice: "Final price",
    search: "Search",
    searchPlaceholder: "Course name or code",
    allTypes: "All types",
    apply: "Apply",
    reset: "Reset",
    results: "Current results",
    showing: "Showing",
    to: "to",
    fromTotal: "of",
    page: "Page",
    of: "of",
    previous: "Previous",
    next: "Next",
    noDescription: "No description is available for this package yet.",
    unavailable: "Not available",
    unspecified: "Unspecified",
  };
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatCurrency(
  value: Prisma.Decimal | null | undefined,
  locale: string,
  unavailableLabel: string,
) {
  if (!value) {
    return unavailableLabel;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDuration(
  days: number | null,
  hours: number | null,
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

  return parts.length ? parts.join(" / ") : labels.unspecified;
}

function normalizeSingleValue(value?: string) {
  return value?.trim() || "";
}

function normalizePage(value?: string) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function buildUrl(
  packageId: string,
  params: {
    q?: string;
    type?: string;
    page?: number;
  },
) {
  const search = new URLSearchParams();

  if (params.q) {
    search.set("q", params.q);
  }

  if (params.type) {
    search.set("type", params.type);
  }

  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }

  const query = search.toString();
  return query ? `/packages/${packageId}?${query}` : `/packages/${packageId}`;
}

export default async function PackageDetailPage({
  params,
  searchParams,
}: PackageDetailPageProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const locale = await getLocale();
  const localeText = t(locale);
  const details = detailText(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";
  const platformRole = await getCurrentPlatformRole();
  const canSeeFinancials = canViewFinancials(platformRole);
  const searchTerm = normalizeSingleValue(query.q);
  const deliveryType = normalizeSingleValue(query.type) as DeliveryType | "";
  const currentPage = normalizePage(query.page);

  const pkg = await db.package.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          courses: true,
        },
      },
    },
  });

  if (!pkg) {
    notFound();
  }

  const whereClause: Prisma.CourseWhereInput = {
    packageId: pkg.id,
    activeStatus: ActiveStatus.ACTIVE,
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

  const totalCourses = await db.course.count({
    where: whereClause,
  });

  const totalPages = Math.max(1, Math.ceil(totalCourses / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const courses = await db.course.findMany({
    where: whereClause,
    include: {
      category: true,
      pricingRecords: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { courseCode: "asc" },
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/packages"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-ink)] hover:underline"
            >
              <span aria-hidden="true">←</span>
              <span>{details.back}</span>
            </Link>
            <p className="eyebrow">{details.title}</p>
            <h2 className="section-title">
              {pkg.code} | {pkg.nameEn || pkg.nameAr}
            </h2>
            <p className="section-copy">{details.description}</p>
          </div>
          <Link href="/courses" className="action-link">
            {localeText.packages.goToCourses}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title={details.courseCount}
          value={formatNumber(pkg._count.courses, numberLocale)}
        />
        <MetricCard
          title={details.target}
          value={formatNumber(pkg.expectedTraineeCount ?? 0, numberLocale)}
        />
        {canSeeFinancials ? (
          <MetricCard
            title={details.discountedValue}
            value={formatCurrency(pkg.discountedTotalAmount, numberLocale, details.unavailable)}
          />
        ) : null}
      </section>

      <section className="panel-surface">
        <p className="eyebrow">{details.title}</p>
        <div className="jawraa-card mt-4 p-4">
          <p className="text-sm leading-7 text-[var(--ink-strong)]">
            {pkg.description || details.noDescription}
          </p>
        </div>
      </section>

      <section className="panel-surface">
        <div className="mb-5">
          <p className="eyebrow">{details.courseList}</p>
          <h3 className="section-title">{details.courseList}</h3>
        </div>

        <form className="grid gap-4 xl:grid-cols-[1.3fr_0.8fr_auto]">
          <label className="field-shell">
            <span className="field-label">{details.search}</span>
            <input
              type="search"
              name="q"
              defaultValue={searchTerm}
              placeholder={details.searchPlaceholder}
              className="field-input"
            />
          </label>

          <label className="field-shell">
            <span className="field-label">{details.type}</span>
            <select name="type" defaultValue={deliveryType} className="field-input">
              <option value="">{details.allTypes}</option>
              {Object.entries(localeText.deliveryTypes).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row xl:items-end">
            <button type="submit" className="primary-button w-full sm:w-auto">
              {details.apply}
            </button>
            <Link href={`/packages/${pkg.id}`} className="secondary-button w-full sm:w-auto">
              {details.reset}
            </Link>
          </div>
        </form>

        <div className="mb-5 mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h4 className="text-lg font-semibold text-[var(--ink-strong)]">
              {details.results}
            </h4>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              {totalCourses > 0
                ? `${details.showing} ${formatNumber(startIndex, numberLocale)} ${details.to} ${formatNumber(endIndex, numberLocale)} ${details.fromTotal} ${formatNumber(totalCourses, numberLocale)}`
                : localeText.courses.noResults}
            </p>
          </div>
          <div className="rounded-full border border-[var(--brand-yellow)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink-soft)]">
            {details.page} {formatNumber(safePage, numberLocale)} {details.of} {formatNumber(totalPages, numberLocale)}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{details.code}</th>
                <th>{localeText.courses.name}</th>
                <th>{details.category}</th>
                <th>{details.type}</th>
                <th>{details.duration}</th>
                {canSeeFinancials ? <th>{details.finalPrice}</th> : null}
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => {
                const latestPricing = course.pricingRecords[0];

                return (
                  <tr
                    key={course.id}
                    className="cursor-pointer transition hover:bg-white"
                  >
                    <td className="latin-cell">
                      <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                        {course.courseCode}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                        <p className="font-semibold text-[var(--ink-strong)]">
                          {course.nameEn || course.nameAr}
                        </p>
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
                        {formatDuration(course.defaultDurationDays, course.defaultDurationHours, {
                          unspecified: details.unspecified,
                          day: localeText.units.day,
                          days: localeText.units.days,
                          hour: localeText.units.hour,
                          hours: localeText.units.hours,
                        })}
                      </Link>
                    </td>
                    {canSeeFinancials ? (
                      <td>
                        <Link href={`/courses/${course.id}`} className="block w-full no-underline">
                          {formatCurrency(
                            latestPricing?.finalUnitPriceWithoutTax,
                            numberLocale,
                            details.unavailable,
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

        {totalPages > 1 ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildUrl(pkg.id, {
                  q: searchTerm,
                  type: deliveryType,
                  page: Math.max(1, safePage - 1),
                })}
                aria-disabled={safePage <= 1}
                className={`secondary-button w-full sm:w-auto ${safePage <= 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                {details.previous}
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
                      href={buildUrl(pkg.id, {
                        q: searchTerm,
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
                href={buildUrl(pkg.id, {
                  q: searchTerm,
                  type: deliveryType,
                  page: Math.min(totalPages, safePage + 1),
                })}
                aria-disabled={safePage >= totalPages}
                className={`secondary-button w-full sm:w-auto ${safePage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
              >
                {details.next}
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function MetricCard({
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
