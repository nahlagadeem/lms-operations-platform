import Link from "next/link";
import { LocationType, Prisma } from "@prisma/client";
import { createLocation } from "@/app/locations/actions";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";

type LocationsPageProps = {
  searchParams?: Promise<{
    q?: string;
    type?: string;
    panel?: string;
  }>;
};

function normalizeSingleValue(value?: string) {
  return value?.trim() || "";
}

function pageText(locale: "en" | "ar") {
  if (locale === "ar") {
    return {
      eyebrow: "المواقع",
      title: "إدارة المواقع",
      description: "إدارة مواقع التنفيذ والفروع والقاعات والخيارات الافتراضية أو الدولية المستخدمة في تشغيل الدورات.",
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
      linkedRuns: "التشغيلات المرتبطة",
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
    description: "Manage internal venues, external locations, online delivery, and international locations used for active courses.",
    addButton: "Add Location",
    createTitle: "Add Location",
    close: "Close",
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
    linkedRuns: "Active Courses",
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
      INTERNAL_VENUE: "Internal venue",
      EXTERNAL_VENUE: "External venue",
      ONLINE: "Online",
      INTERNATIONAL: "International",
    } as Record<LocationType, string>,
  };
}

export default async function LocationsPage({ searchParams }: LocationsPageProps) {
  const locale = await getLocale();
  const text = pageText(locale);
  const params = (await searchParams) ?? {};
  const searchTerm = normalizeSingleValue(params.q);
  const typeFilter = normalizeSingleValue(params.type) as LocationType | "";
  const openPanel = params.panel === "create" ? "create" : "";

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

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">{text.eyebrow}</p>
            <h2 className="section-title">{text.title}</h2>
            <p className="section-copy">{text.description}</p>
          </div>
          <Link href="/locations?panel=create" className="primary-button w-full sm:w-auto">
            {text.addButton}
          </Link>
        </div>
      </section>

      <section className="panel-surface">
        <form className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_auto]">
          <label className="field-shell">
            <span className="field-label">{text.search}</span>
            <input
              type="search"
              name="q"
              defaultValue={searchTerm}
              placeholder={text.searchPlaceholder}
              className="field-input"
            />
          </label>

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
                {locations.map((location) => (
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
          </div>
        )}
      </section>

      {openPanel ? (
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
