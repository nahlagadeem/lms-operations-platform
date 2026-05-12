import Link from "next/link";
import { db } from "@/lib/db";
import { getLocale, t } from "@/lib/locale";

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatCurrency(value: number | null, locale: string, unavailableLabel: string) {
  if (value === null) {
    return unavailableLabel;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function HomePage() {
  const locale = await getLocale();
  const localeText = t(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";

  const [packageCount, courseCount, runCount, packageRows] = await Promise.all([
    db.package.count(),
    db.course.count(),
    db.courseRun.count(),
    db.package.findMany({
      orderBy: { code: "asc" },
      include: {
        _count: {
          select: {
            courses: true,
          },
        },
      },
    }),
  ]);

  const totalExpectedTrainees = packageRows.reduce(
    (sum, item) => sum + (item.expectedTraineeCount ?? 0),
    0,
  );
  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={localeText.home.packageCount}
          value={formatNumber(packageCount, numberLocale)}
        />
        <MetricCard
          title={localeText.home.importedCourses}
          value={formatNumber(courseCount, numberLocale)}
        />
        <MetricCard
          title={localeText.home.targetTrainees}
          value={formatNumber(totalExpectedTrainees, numberLocale)}
        />
        <MetricCard
          title={localeText.home.activeRuns}
          value={runCount === 0 ? "0" : formatNumber(runCount, numberLocale)}
          subtitle={localeText.home.activeRunsHint}
        />
      </section>

      <section className="grid gap-6">
        <div className="panel-surface">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">{localeText.home.catalogSnapshot}</p>
              <h2 className="section-title">{localeText.home.packageSummary}</h2>
            </div>
            <Link href="/packages" className="action-link">
              {localeText.home.viewAllPackages}
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{localeText.home.packageCode}</th>
                  <th>{localeText.home.packageName}</th>
                  <th>{localeText.home.courseCount}</th>
                  <th>{localeText.home.target}</th>
                  <th>{localeText.home.discountedValue}</th>
                </tr>
              </thead>
              <tbody>
                {packageRows.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer transition hover:bg-[var(--surface-muted)]"
                  >
                    <td className="latin-cell">
                      <Link href={`/packages/${item.id}`} className="block w-full no-underline">
                        {item.code}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/packages/${item.id}`} className="block w-full no-underline">
                        {item.nameEn || item.nameAr}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/packages/${item.id}`} className="block w-full no-underline">
                        {formatNumber(item._count.courses, numberLocale)}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/packages/${item.id}`} className="block w-full no-underline">
                        {formatNumber(item.expectedTraineeCount ?? 0, numberLocale)}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/packages/${item.id}`} className="block w-full no-underline">
                        {formatCurrency(
                          Number(item.discountedTotalAmount ?? 0),
                          numberLocale,
                          localeText.home.unavailable,
                        )}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel-surface">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">{localeText.home.quickAccess}</p>
            <h2 className="section-title">{localeText.home.quickAccess}</h2>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <QuickLinkCard
            href="/packages"
            title={localeText.home.packagesTitle}
            description={localeText.home.packagesDescription}
          />
          <QuickLinkCard
            href="/courses"
            title={localeText.home.coursesTitle}
            description={localeText.home.coursesDescription}
          />
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <article className="overflow-hidden rounded-[24px] border border-[var(--brand-yellow)] bg-white p-5 shadow-[0_18px_44px_rgba(17,17,17,0.05)]">
      <div>
        <p className="text-sm font-medium text-[var(--ink-soft)]">{title}</p>
        <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink-strong)]">
          {value}
        </p>
        {subtitle ? (
          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{subtitle}</p>
        ) : null}
      </div>
    </article>
  );
}

function QuickLinkCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[24px] border border-[var(--line-soft)] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-[0_14px_30px_rgba(12,32,52,0.09)]"
    >
      <p className="text-xl font-semibold text-[var(--ink-strong)]">{title}</p>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
    </Link>
  );
}
