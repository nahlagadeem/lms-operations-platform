import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { createVendor } from "@/app/providers/actions";
import { VendorType } from "@/lib/brd-terminology";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import {
  canCreateOperationalData,
  getCurrentPlatformRole,
  isCustomerCapacityOnly,
} from "@/lib/permissions";

type ProvidersPageProps = {
  searchParams?: Promise<{
    q?: string;
    type?: string;
    panel?: string;
    error?: string;
  }>;
};

function normalizeSingleValue(value?: string) {
  return value?.trim() || "";
}

function pageText(locale: "en" | "ar") {
  if (locale === "ar") {
    return {
      eyebrow: "الموردون",
      title: "إدارة الموردين",
      description: "إدارة الموردين ومراكز التدريب والجامعات والجهات المرتبطة بتنفيذ التدريبات.",
      addButton: "إضافة مورد",
      openForm: "فتح نموذج الإضافة",
      close: "إغلاق",
      createTitle: "إضافة مورد جديد",
      search: "بحث",
      searchPlaceholder: "اسم الجهة أو المدينة",
      type: "نوع الجهة",
      allTypes: "كل الأنواع",
      apply: "تطبيق",
      reset: "إعادة ضبط",
      name: "المورد",
      city: "المدينة",
      contact: "التواصل",
      linkedRuns: "التدريبات المرتبطة",
      noResults: "لا يوجد موردون مطابقون للفلاتر الحالية.",
      providerType: "نوع المورد",
      nameAr: "الاسم بالعربية",
      nameEn: "الاسم بالإنجليزية",
      country: "الدولة",
      contactPerson: "الشخص المسؤول",
      email: "البريد الإلكتروني",
      phone: "رقم الهاتف",
      website: "الموقع الإلكتروني",
      notes: "ملاحظات",
      save: "حفظ المورد",
      empty: "غير متوفر",
      types: {
        TRAINING_CENTER: "مركز تدريب",
        UNIVERSITY: "جامعة",
        CERTIFICATION_BODY: "جهة شهادات",
        CONFERENCE_ORGANIZER: "منظم مؤتمرات",
        VENDOR: "مورد",
      } as Record<VendorType, string>,
    };
  }

  return {
    eyebrow: "Vendors",
    title: "Vendors",
    description: "Manage vendors, training centers, universities, certification bodies, and other partners used by trainings.",
    addButton: "Add Vendor",
    openForm: "Open add form",
    close: "Close",
    createTitle: "Add Vendor",
    missingRequired: "Please choose a vendor type and enter a name.",
    search: "Search",
    searchPlaceholder: "Vendor name or city",
    type: "Vendor type",
    allTypes: "All types",
    apply: "Apply Filters",
    reset: "Reset Filters",
    name: "Vendor",
    city: "City",
    contact: "Contact",
    linkedRuns: "Trainings",
    noResults: "No vendors match these filters. Click Add Vendor to create one.",
    providerType: "Vendor type",
    nameAr: "Arabic name",
    nameEn: "English name",
    country: "Country",
    contactPerson: "Contact person",
    email: "Email",
    phone: "Phone",
    website: "Website",
    notes: "Notes",
    save: "Add Vendor",
    empty: "Not available",
    types: {
      TRAINING_CENTER: "Training center",
      UNIVERSITY: "University",
      CERTIFICATION_BODY: "Certification body",
      CONFERENCE_ORGANIZER: "Conference organizer",
      VENDOR: "Vendor",
    } as Record<VendorType, string>,
  };
}

export default async function ProvidersPage({ searchParams }: ProvidersPageProps) {
  const locale = await getLocale();
  const text = pageText(locale);
  const params = (await searchParams) ?? {};
  const platformRole = await getCurrentPlatformRole();
  const canCreate = canCreateOperationalData(platformRole);

  if (isCustomerCapacityOnly(platformRole)) {
    redirect("/");
  }

  const searchTerm = normalizeSingleValue(params.q);
  const typeFilter = normalizeSingleValue(params.type) as VendorType | "";
  const openPanel = params.panel === "create" ? "create" : "";
  const showRequiredError = params.error === "missing-required";
  const missingRequiredMessage =
    "missingRequired" in text
      ? text.missingRequired
      : "Please choose a vendor type and enter a name.";

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
          {canCreate ? (
            <Link href="/vendors?panel=create" className="primary-button w-full sm:w-auto">
              {text.addButton}
            </Link>
          ) : null}
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
            <Link href="/vendors" className="secondary-button w-full sm:w-auto">
              {text.reset}
            </Link>
          </div>
        </form>

        {providers.length === 0 ? (
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

      {openPanel && canCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,25,35,0.55)] p-4">
          <div className="jawraa-card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{text.eyebrow}</p>
                <h3 className="section-title">{text.createTitle}</h3>
              </div>
              <Link href="/vendors" className="secondary-button">
                {text.close}
              </Link>
            </div>

            <form action={createVendor} className="space-y-4">
              {showRequiredError ? (
                <p className="rounded-[8px] border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                  {missingRequiredMessage}
                </p>
              ) : null}

              <label className="field-shell">
                <span className="field-label">{text.providerType}</span>
                <select name="providerType" className="field-input" defaultValue={VendorType.TRAINING_CENTER}>
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
