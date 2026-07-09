import Link from "next/link";
import { InstantSearchField } from "@/components/instant-search-field";
import { getLocale, t } from "@/lib/locale";
import { loadPackageCatalogRows } from "@/server/services/catalog-table-service";

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

function normalizeSearch(value?: string) {
  return value?.trim() || "";
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

  const packages = await loadPackageCatalogRows(locale);
  const filteredPackages = packages.filter((item) => {
    if (!searchKey) return true;
    return [item.code, item.displayName, item.nameAr, item.nameEn, item.description]
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
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <InstantSearchField
            label={localeText.packages.search}
            defaultValue={searchTerm}
            placeholder={localeText.packages.searchPlaceholder}
            pageParams={["page"]}
          />
          <Link href={pageHref(1, searchTerm)} className="secondary-button self-end">
            {localeText.packages.reset}
          </Link>
          <Link
            href={`/api/packages/export${searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ""}`}
            className="primary-button self-end"
          >
            {localeText.buttons.exportExcel}
          </Link>
        </form>
      </section>

      <section className="panel-surface min-w-0">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--ink-strong)]">
              {localeText.packages.listTitle}
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              {filteredPackages.length > 0
                ? `${localeText.packages.showing} ${formatNumber(
                    (safePage - 1) * PACKAGES_PAGE_SIZE + 1,
                    numberLocale,
                  )} ${localeText.packages.to} ${formatNumber(
                    Math.min(safePage * PACKAGES_PAGE_SIZE, filteredPackages.length),
                    numberLocale,
                  )} ${localeText.packages.fromTotal} ${formatNumber(
                    filteredPackages.length,
                    numberLocale,
                  )}`
                : localeText.packages.noResults}
            </p>
          </div>
          <div className="rounded-full border border-[var(--brand-yellow)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink-soft)]">
            {localeText.packages.page} {formatNumber(safePage, numberLocale)} {localeText.packages.of} {formatNumber(totalPages, numberLocale)}
          </div>
        </div>

        {visiblePackages.length === 0 ? (
          <div className="jawraa-subcard border-dashed px-5 py-8 text-center">
            <p className="text-lg font-semibold text-[var(--ink-strong)]">
              {localeText.packages.noResults}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{localeText.packages.package}</th>
                  <th>{localeText.packages.totalCourses}</th>
                  <th>{localeText.packages.estimatedSeats}</th>
                  <th>{localeText.packages.actualSeats}</th>
                  <th>{localeText.packages.details}</th>
                </tr>
              </thead>
              <tbody>
                {visiblePackages.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link href={`/packages/${item.id}`} className="block w-full no-underline">
                        <p className="font-semibold text-[var(--ink-strong)]">{item.displayName}</p>
                        {item.description ? (
                          <p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">
                            {item.description}
                          </p>
                        ) : null}
                      </Link>
                    </td>
                    <td className="latin-cell">
                      <Link href={`/packages/${item.id}`} className="block w-full no-underline">
                        {formatNumber(item.courseCount, numberLocale)}
                      </Link>
                    </td>
                    <td className="latin-cell">
                      <Link href={`/packages/${item.id}`} className="block w-full no-underline">
                        {formatNumber(item.estimatedSeats, numberLocale)}
                      </Link>
                    </td>
                    <td className="latin-cell">
                      <Link href={`/packages/${item.id}`} className="block w-full no-underline">
                        {formatNumber(item.actualSeats, numberLocale)}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/packages/${item.id}`} className="secondary-button inline-flex">
                        {localeText.packages.details}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredPackages.length > PACKAGES_PAGE_SIZE ? (
          <div
            className="mt-6 flex flex-wrap items-center justify-between gap-3"
            dir={locale === "ar" ? "rtl" : "ltr"}
          >
            <div className="flex flex-wrap gap-2">
              <Link
                href={pageHref(Math.max(1, safePage - 1), searchTerm)}
                aria-disabled={safePage <= 1}
                className={`secondary-button w-full sm:w-auto ${safePage <= 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                {localeText.packages.previous}
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
                        href={pageHref(pageNumber, searchTerm)}
                        className={`pagination-link ${pageNumber === safePage ? "pagination-link-active" : ""}`}
                      >
                        {formatNumber(pageNumber, numberLocale)}
                      </Link>
                    )}
                  </div>
                );
              })}

              <Link
                href={pageHref(Math.min(totalPages, safePage + 1), searchTerm)}
                aria-disabled={safePage >= totalPages}
                className={`secondary-button w-full sm:w-auto ${safePage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
              >
                {localeText.packages.next}
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
