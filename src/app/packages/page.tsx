import Link from "next/link";
import { InstantSearchField } from "@/components/instant-search-field";
import { db } from "@/lib/db";
import { getLocale, t } from "@/lib/locale";

type PackagesPageProps = {
  searchParams?: Promise<{
    page?: string;
    q?: string;
  }>;
};

const PACKAGES_PAGE_SIZE = 10;

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
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

function pageHref(page: number, q: string) {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (page > 1) query.set("page", String(page));
  const queryString = query.toString();
  return queryString ? `/packages?${queryString}` : "/packages";
}

export default async function PackagesPage({ searchParams }: PackagesPageProps) {
  const locale = await getLocale();
  const localeText = t(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";
  const params = (await searchParams) ?? {};
  const requestedPage = normalizePage(params.page);
  const searchTerm = normalizeSearch(params.q);
  const searchKey = searchTerm.toLowerCase();

  const packages = await db.package.findMany({
    orderBy: { code: "asc" },
    include: {
      _count: {
        select: {
          courses: true,
        },
      },
    },
  });
  const filteredPackages = packages.filter((item) => {
    if (!searchKey) return true;
    return [item.code, item.nameEn, item.nameAr, item.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(searchKey);
  });
  const totalPages = Math.max(1, Math.ceil(filteredPackages.length / PACKAGES_PAGE_SIZE));
  const safePage = Math.min(requestedPage, totalPages);
  const visiblePackages = filteredPackages.slice(
    (safePage - 1) * PACKAGES_PAGE_SIZE,
    safePage * PACKAGES_PAGE_SIZE,
  );

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{localeText.packages.eyebrow}</p>
            <h2 className="section-title">{localeText.packages.title}</h2>
            <p className="section-copy">{localeText.packages.description}</p>
          </div>
          <Link href="/courses" className="action-link">
            {localeText.packages.goToCourses}
          </Link>
        </div>
      </section>

      <section className="panel-surface">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <InstantSearchField
            label={localeText.common.search}
            defaultValue={searchTerm}
            placeholder={localeText.common.searchPlaceholder}
            pageParams={["page"]}
          />
          <Link href="/packages" className="secondary-button self-end">
            {localeText.common.reset}
          </Link>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {visiblePackages.map((item) => (
          <Link
            key={item.id}
            href={`/packages/${item.id}`}
            className="panel-surface block transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(17,17,17,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="latin-chip">{item.code}</p>
                <h3 className="mt-4 text-xl font-semibold text-[var(--ink-strong)]">
                  {item.nameEn || item.nameAr}
                </h3>
              </div>
              <span className="status-pill">{localeText.packages.active}</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <InfoBox
                label={localeText.packages.courseCount}
                value={formatNumber(item._count.courses, numberLocale)}
              />
              <InfoBox
                label={localeText.packages.target}
                value={formatNumber(item.expectedTraineeCount ?? 0, numberLocale)}
              />
            </div>

            {item.description ? (
              <p className="mt-5 text-sm leading-7 text-[var(--ink-soft)]">
                {item.description}
              </p>
            ) : null}
          </Link>
        ))}
        {filteredPackages.length === 0 ? (
          <div className="panel-surface border-dashed text-sm text-[var(--ink-soft)] md:col-span-3">
            {localeText.common.noResults}
          </div>
        ) : null}
      </section>
      {filteredPackages.length > PACKAGES_PAGE_SIZE ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-[var(--ink-soft)]">
            {localeText.pagination.pageIndicator
              .replace("{current}", formatNumber(safePage, numberLocale))
              .replace("{total}", formatNumber(totalPages, numberLocale))}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={pageHref(1, searchTerm)}
              aria-disabled={safePage <= 1}
              className={`pagination-link ${safePage <= 1 ? "pointer-events-none opacity-50" : ""}`}
            >
              {localeText.pagination.first}
            </Link>
            <Link
              href={pageHref(Math.max(1, safePage - 1), searchTerm)}
              aria-disabled={safePage <= 1}
              className={`pagination-link ${safePage <= 1 ? "pointer-events-none opacity-50" : ""}`}
            >
              {localeText.pagination.previous}
            </Link>
            {paginationPages(safePage, totalPages).map((page, index) =>
              page === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                  ...
                </span>
              ) : (
                <Link
                  key={page}
                  href={pageHref(page, searchTerm)}
                  aria-current={page === safePage ? "page" : undefined}
                  className={`pagination-link ${page === safePage ? "pagination-link-active" : ""}`}
                >
                  {formatNumber(page, numberLocale)}
                </Link>
              ),
            )}
            <Link
              href={pageHref(Math.min(totalPages, safePage + 1), searchTerm)}
              aria-disabled={safePage >= totalPages}
              className={`pagination-link ${safePage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
            >
              {localeText.pagination.next}
            </Link>
            <Link
              href={pageHref(totalPages, searchTerm)}
              aria-disabled={safePage >= totalPages}
              className={`pagination-link ${safePage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
            >
              {localeText.pagination.last}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="jawraa-subcard p-4">
      <p className="text-xs font-medium text-[var(--ink-soft)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}
