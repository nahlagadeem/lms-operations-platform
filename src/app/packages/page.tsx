import Link from "next/link";
import { db } from "@/lib/db";
import { getLocale, t } from "@/lib/locale";

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

export default async function PackagesPage() {
  const locale = await getLocale();
  const localeText = t(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";

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

      <section className="grid gap-4 md:grid-cols-3">
        {packages.map((item) => (
          <Link
            key={item.id}
            href={`/packages/${item.id}`}
            className="panel-surface block transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(12,32,52,0.1)]"
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
      </section>
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
    <div className="rounded-[20px] bg-[var(--surface-muted)] p-4">
      <p className="text-xs font-medium text-[var(--ink-soft)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}
