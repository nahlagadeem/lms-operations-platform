import Link from "next/link";
import { LocationType, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { createLocation } from "@/app/locations/actions";
import { InstantSearchField } from "@/components/instant-search-field";
import { db } from "@/lib/db";
import { getLocale, t } from "@/lib/locale";
import {
  canCreateOperationalData,
  getCurrentPlatformRole,
  isCustomerCapacityOnly,
} from "@/lib/permissions";

type LocationsPageProps = {
  searchParams?: Promise<{
    q?: string;
    type?: string;
    panel?: string;
    error?: string;
    page?: string;
  }>;
};

const LOCATIONS_PAGE_SIZE = 10;

function normalizeSingleValue(value?: string) {
  return value?.trim() || "";
}

function normalizePage(value?: string) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
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

function locationsPageHref(page: number, q: string, type: string) {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (type) query.set("type", type);
  if (page > 1) query.set("page", String(page));
  const queryString = query.toString();
  return queryString ? `/locations?${queryString}` : "/locations";
}

function pageText(locale: "en" | "ar") {
  if (locale === "ar") {
    return {
      eyebrow: "المواقع",
      title: "إدارة المواقع",
      description: "إدارة مواقع التنفيذ والفروع والقاعات والخيارات الافتراضية أو الدولية المستخدمة في التدريبات.",
      addButton: "إضافة موقع",
      createTitle: "إضافة موقع جديد",
      close: "إغلاق",
      search: "بحث",
      searchPlaceholder: "اسم الموقع أو المدينة أو الفرع",
      type: "نوع الموقع",
      allTypes: "كل الأنواع",
      apply: "تطبيق",
      reset: "إعادة ضبط",
      name: "الموقع",
      city: "المدينة",
      branch: "الفرع",
      capacity: "السعة",
      linkedRuns: "التدريبات المرتبطة",
      noResults: "لا توجد مواقع مطابقة للفلاتر الحالية.",
      locationType: "نوع الموقع",
      nameAr: "الاسم بالعربية",
      nameEn: "الاسم بالإنجليزية",
      country: "الدولة",
      venueName: "اسم الجهة أو المبنى",
      roomName: "اسم القاعة",
      address: "العنوان",
      timezone: "المنطقة الزمنية",
      save: "حفظ الموقع",
      empty: "غير متوفر",
      types: {
        INTERNAL_VENUE: "موقع داخلي",
        EXTERNAL_VENUE: "موقع خارجي",
        ONLINE: "عن بعد",
        INTERNATIONAL: "دولي",
      } as Record<LocationType, string>,
    };
  }

  return {
    eyebrow: "Locations",
    title: "Location management",
    description: "Manage venues, online delivery options, and international locations used for trainings.",
    addButton: "Add Location",
    createTitle: "Add Location",
    close: "Close",
    missingRequired: "Missing required location fields.",
    search: "Search",
    searchPlaceholder: "Location name, city, or branch",
    type: "Location type",
    allTypes: "All types",
    apply: "Apply Filters",
    reset: "Reset Filters",
    name: "Location",
    city: "City",
    branch: "Branch",
    capacity: "Capacity",
    linkedRuns: "Trainings",
    noResults: "No locations match these filters. Click Add Location to create one.",
    locationType: "Location type",
    nameAr: "Arabic name",
    nameEn: "English name",
    country: "Country",
    venueName: "Venue name",
    roomName: "Room name",
    address: "Address",
    timezone: "Timezone",
    save: "Add Location",
    empty: "Not available",
    types: {
      INTERNAL_VENUE: "Company venue",
      EXTERNAL_VENUE: "External venue",
      ONLINE: "Online",
      INTERNATIONAL: "International",
    } as Record<LocationType, string>,
  };
}

export default async function LocationsPage({ searchParams }: LocationsPageProps) {
  const locale = await getLocale();
  const localeText = t(locale);
  const text = pageText(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";
  const params = (await searchParams) ?? {};
  const platformRole = await getCurrentPlatformRole();
  const canCreate = canCreateOperationalData(platformRole);

  if (isCustomerCapacityOnly(platformRole)) {
    redirect("/");
  }

  const searchTerm = normalizeSingleValue(params.q);
  const typeFilter = normalizeSingleValue(params.type) as LocationType | "";
  const requestedPage = normalizePage(params.page);
  const openPanel = params.panel === "create" ? "create" : "";
  const showRequiredError = params.error === "missing-required";
  const missingRequiredMessage =
    "missingRequired" in text ? text.missingRequired : "Missing required location fields.";

  const whereClause: Prisma.LocationWhereInput = {
    locationType: typeFilter || undefined,
    OR: searchTerm
      ? [
          { nameAr: { contains: searchTerm, mode: "insensitive" } },
          { nameEn: { contains: searchTerm, mode: "insensitive" } },
          { city: { contains: searchTerm, mode: "insensitive" } },
          { branch: { contains: searchTerm, mode: "insensitive" } },
        ]
      : undefined,
  };

  const locations = await db.location.findMany({
    where: whereClause,
    include: {
      _count: {
        select: {
          courseRuns: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
  const totalPages = Math.max(1, Math.ceil(locations.length / LOCATIONS_PAGE_SIZE));
  const safePage = Math.min(requestedPage, totalPages);
  const visibleLocations = locations.slice(
    (safePage - 1) * LOCATIONS_PAGE_SIZE,
    safePage * LOCATIONS_PAGE_SIZE,
  );

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">{text.eyebrow}</p>
            <h2 className="section-title">{text.title}</h2>
            <p className="section-copy">{text.description}</p>
          </div>
          {canCreate ? (
            <Link href="/locations?panel=create" className="primary-button w-full sm:w-auto">
              {text.addButton}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="panel-surface">
        <form className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_auto]">
          <InstantSearchField
            label={text.search}
            defaultValue={searchTerm}
            placeholder={localeText.common.searchPlaceholder}
            pageParams={["page"]}
          />

          <label className="field-shell">
            <span className="field-label">{text.type}</span>
            <select name="type" defaultValue={typeFilter} className="field-input">
              <option value="">{text.allTypes}</option>
              {Object.entries(text.types).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row xl:items-end">
            <button type="submit" className="primary-button w-full sm:w-auto">
              {text.apply}
            </button>
            <Link href="/locations" className="secondary-button w-full sm:w-auto">
              {text.reset}
            </Link>
          </div>
        </form>

        {locations.length === 0 ? (
          <div className="jawraa-subcard mt-6 border-dashed px-5 py-8 text-sm text-[var(--ink-soft)]">
            {text.noResults}
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.name}</th>
                  <th>{text.type}</th>
                  <th>{text.city}</th>
                  <th>{text.branch}</th>
                  <th>{text.capacity}</th>
                  <th>{text.linkedRuns}</th>
                </tr>
              </thead>
              <tbody>
                {visibleLocations.map((location) => (
                  <tr key={location.id}>
                    <td>{location.nameEn || location.nameAr}</td>
                    <td>{text.types[location.locationType]}</td>
                    <td>{location.city || text.empty}</td>
                    <td>{location.branch || text.empty}</td>
                    <td>{location.capacity ?? text.empty}</td>
                    <td>{location._count.courseRuns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {locations.length > LOCATIONS_PAGE_SIZE ? (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[var(--ink-soft)]">
                  {localeText.pagination.pageIndicator
                    .replace("{current}", formatNumber(safePage, numberLocale))
                    .replace("{total}", formatNumber(totalPages, numberLocale))}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={locationsPageHref(1, searchTerm, typeFilter)}
                    aria-disabled={safePage <= 1}
                    className={`pagination-link ${safePage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.first}
                  </Link>
                  <Link
                    href={locationsPageHref(Math.max(1, safePage - 1), searchTerm, typeFilter)}
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
                        href={locationsPageHref(page, searchTerm, typeFilter)}
                        aria-current={page === safePage ? "page" : undefined}
                        className={`pagination-link ${page === safePage ? "pagination-link-active" : ""}`}
                      >
                        {formatNumber(page, numberLocale)}
                      </Link>
                    ),
                  )}
                  <Link
                    href={locationsPageHref(Math.min(totalPages, safePage + 1), searchTerm, typeFilter)}
                    aria-disabled={safePage >= totalPages}
                    className={`pagination-link ${safePage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.next}
                  </Link>
                  <Link
                    href={locationsPageHref(totalPages, searchTerm, typeFilter)}
                    aria-disabled={safePage >= totalPages}
                    className={`pagination-link ${safePage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
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
                <p className="eyebrow">{text.eyebrow}</p>
                <h3 className="section-title">{text.createTitle}</h3>
              </div>
              <Link href="/locations" className="secondary-button">
                {text.close}
              </Link>
            </div>

            <form action={createLocation} className="space-y-4">
              {showRequiredError ? (
                <p className="rounded-[8px] border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                  {missingRequiredMessage}
                </p>
              ) : null}

              <label className="field-shell">
                <span className="field-label">{text.locationType}</span>
                <select name="locationType" className="field-input" defaultValue={LocationType.INTERNAL_VENUE}>
                  {Object.entries(text.types).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-shell">
                  <span className="field-label">{text.nameAr}</span>
                  <input type="text" name="nameAr" className="field-input" />
                </label>
                <label className="field-shell">
                  <span className="field-label">{text.nameEn}</span>
                  <input type="text" name="nameEn" className="field-input" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-shell">
                  <span className="field-label">{text.country}</span>
                  <input type="text" name="country" className="field-input" />
                </label>
                <label className="field-shell">
                  <span className="field-label">{text.city}</span>
                  <input type="text" name="city" className="field-input" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-shell">
                  <span className="field-label">{text.branch}</span>
                  <input type="text" name="branch" className="field-input" />
                </label>
                <label className="field-shell">
                  <span className="field-label">{text.capacity}</span>
                  <input type="number" name="capacity" min="0" step="1" className="field-input" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-shell">
                  <span className="field-label">{text.venueName}</span>
                  <input type="text" name="venueName" className="field-input" />
                </label>
                <label className="field-shell">
                  <span className="field-label">{text.roomName}</span>
                  <input type="text" name="roomName" className="field-input" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-shell">
                  <span className="field-label">{text.address}</span>
                  <input type="text" name="address" className="field-input" />
                </label>
                <label className="field-shell">
                  <span className="field-label">{text.timezone}</span>
                  <input type="text" name="timezone" className="field-input" />
                </label>
              </div>

              <button type="submit" className="primary-button w-full sm:w-auto">
                {text.save}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
