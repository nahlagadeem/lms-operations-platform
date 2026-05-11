import Link from "next/link";
import { ProviderType, Prisma } from "@prisma/client";
import { createProvider } from "@/app/providers/actions";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";

type ProvidersPageProps = {
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
      eyebrow: "الجهات",
      title: "إدارة الجهات",
      description: "إدارة الجهات المنفذة ومراكز التدريب والجامعات والجهات المرتبطة بتشغيل الدورات.",
      addButton: "إضافة جهة",
      openForm: "فتح نموذج الإضافة",
      close: "إغلاق",
      createTitle: "إضافة جهة جديدة",
      search: "بحث",
      searchPlaceholder: "اسم الجهة أو المدينة",
      type: "نوع الجهة",
      allTypes: "كل الأنواع",
      apply: "تطبيق",
      reset: "إعادة ضبط",
      name: "الجهة",
      city: "المدينة",
      contact: "التواصل",
      linkedRuns: "التشغيلات المرتبطة",
      noResults: "لا توجد جهات مطابقة للفلاتر الحالية.",
      providerType: "نوع الجهة",
      nameAr: "الاسم بالعربية",
      nameEn: "الاسم بالإنجليزية",
      country: "الدولة",
      contactPerson: "الشخص المسؤول",
      email: "البريد الإلكتروني",
      phone: "رقم الهاتف",
      website: "الموقع الإلكتروني",
      notes: "ملاحظات",
      save: "حفظ الجهة",
      empty: "غير متوفر",
      types: {
        TRAINING_CENTER: "مركز تدريب",
        UNIVERSITY: "جامعة",
        CERTIFICATION_BODY: "جهة شهادات",
        CONFERENCE_ORGANIZER: "منظم مؤتمرات",
        VENDOR: "مورد",
      } as Record<ProviderType, string>,
    };
  }

  return {
    eyebrow: "Providers",
    title: "Provider management",
    description: "Manage delivery partners, training centers, universities, and other providers used by course runs.",
    addButton: "Add provider",
    openForm: "Open add form",
    close: "Close",
    createTitle: "Create provider",
    search: "Search",
    searchPlaceholder: "Provider name or city",
    type: "Provider type",
    allTypes: "All types",
    apply: "Apply",
    reset: "Reset",
    name: "Provider",
    city: "City",
    contact: "Contact",
    linkedRuns: "Linked runs",
    noResults: "No providers matched the current filters.",
    providerType: "Provider type",
    nameAr: "Arabic name",
    nameEn: "English name",
    country: "Country",
    contactPerson: "Contact person",
    email: "Email",
    phone: "Phone",
    website: "Website",
    notes: "Notes",
    save: "Save provider",
    empty: "Not available",
    types: {
      TRAINING_CENTER: "Training center",
      UNIVERSITY: "University",
      CERTIFICATION_BODY: "Certification body",
      CONFERENCE_ORGANIZER: "Conference organizer",
      VENDOR: "Vendor",
    } as Record<ProviderType, string>,
  };
}

export default async function ProvidersPage({ searchParams }: ProvidersPageProps) {
  const locale = await getLocale();
  const text = pageText(locale);
  const params = (await searchParams) ?? {};
  const searchTerm = normalizeSingleValue(params.q);
  const typeFilter = normalizeSingleValue(params.type) as ProviderType | "";
  const openPanel = params.panel === "create" ? "create" : "";

  const whereClause: Prisma.ProviderWhereInput = {
    providerType: typeFilter || undefined,
    OR: searchTerm
      ? [
          { nameAr: { contains: searchTerm, mode: "insensitive" } },
          { nameEn: { contains: searchTerm, mode: "insensitive" } },
          { city: { contains: searchTerm, mode: "insensitive" } },
        ]
      : undefined,
  };

  const providers = await db.provider.findMany({
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
          <Link href="/providers?panel=create" className="primary-button w-full sm:w-auto">
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
            <Link href="/providers" className="secondary-button w-full sm:w-auto">
              {text.reset}
            </Link>
          </div>
        </form>

        {providers.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-[var(--line-soft)] bg-[var(--surface-muted)] px-5 py-8 text-sm text-[var(--ink-soft)]">
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
                  <th>{text.contact}</th>
                  <th>{text.linkedRuns}</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider.id}>
                    <td>{provider.nameEn || provider.nameAr}</td>
                    <td>{text.types[provider.providerType]}</td>
                    <td>{provider.city || text.empty}</td>
                    <td>{provider.contactPerson || provider.email || provider.phone || text.empty}</td>
                    <td>{provider._count.courseRuns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openPanel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,25,35,0.55)] p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_30px_70px_rgba(10,25,35,0.35)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{text.eyebrow}</p>
                <h3 className="section-title">{text.createTitle}</h3>
              </div>
              <Link href="/providers" className="secondary-button">
                {text.close}
              </Link>
            </div>

            <form action={createProvider} className="space-y-4">
              <label className="field-shell">
                <span className="field-label">{text.providerType}</span>
                <select name="providerType" className="field-input" defaultValue={ProviderType.TRAINING_CENTER}>
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
                  <span className="field-label">{text.contactPerson}</span>
                  <input type="text" name="contactPerson" className="field-input" />
                </label>
                <label className="field-shell">
                  <span className="field-label">{text.email}</span>
                  <input type="email" name="email" className="field-input" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-shell">
                  <span className="field-label">{text.phone}</span>
                  <input type="text" name="phone" className="field-input" />
                </label>
                <label className="field-shell">
                  <span className="field-label">{text.website}</span>
                  <input type="text" name="website" className="field-input" />
                </label>
              </div>

              <label className="field-shell">
                <span className="field-label">{text.notes}</span>
                <textarea name="notes" rows={4} className="field-input min-h-[7rem] resize-y" />
              </label>

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
