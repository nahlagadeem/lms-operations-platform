import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatCurrency(value: Prisma.Decimal | null | undefined, locale: string) {
  if (!value) return "-";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function progressValue(value: Prisma.Decimal | null | undefined) {
  return value ? Number(value) : 0;
}

export default async function ProjectStructurePage() {
  const locale = await getLocale();
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";

  const scopes = await db.projectScope.findMany({
    where: { code: "01" },
    orderBy: { code: "asc" },
    include: {
      packages: {
        orderBy: { code: "asc" },
        include: {
          _count: {
            select: { courses: true },
          },
        },
      },
      selectedCourses: {
        include: {
          course: {
            include: {
              package: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const totals = scopes.reduce(
    (summary, scope) => {
      summary.packages += scope.packages.length;
      summary.courses += scope.selectedCourses.length;
      summary.budget += Number(scope.budgetAmount ?? 0);
      summary.invoiced += Number(scope.invoicedAmount ?? 0);
      return summary;
    },
    { packages: 0, courses: 0, budget: 0, invoiced: 0 },
  );

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Project Scope</p>
            <h2 className="section-title">Project Scope</h2>
            <p className="section-copy">
              View project scopes, packages, courses, budget progress, and related files from one place.
            </p>
          </div>
          <Link href="/course-runs" className="action-link">
            Active courses
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Project Scopes" value={formatNumber(scopes.length, numberLocale)} />
        <MetricCard title="Packages" value={formatNumber(totals.packages, numberLocale)} />
        <MetricCard title="Courses" value={formatNumber(totals.courses, numberLocale)} />
        <MetricCard
          title="Budget"
          value={formatCurrency(new Prisma.Decimal(totals.budget), numberLocale)}
        />
      </section>

      <section className="grid gap-4">
        {scopes.map((scope) => {
          const courseCount = scope.selectedCourses.length;
          const actual = progressValue(scope.actualCompletion);
          const planned = progressValue(scope.plannedCompletion);
          const isDelayed = actual < planned;

          return (
            <Link
              key={scope.id}
              href={`/project-structure/scopes/${scope.id}`}
              className="panel-surface block transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(17,17,17,0.08)]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="latin-chip">{scope.code}</p>
                  <h3 className="mt-4 text-2xl font-semibold text-[var(--ink-strong)]">
                    {scope.name}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                    {scope.description || "Packages, courses, budget, and files for this project scope."}
                  </p>
                </div>
                <span className="status-pill">{isDelayed ? "Needs attention" : "On track"}</span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <InfoBox label="Packages" value={formatNumber(scope.packages.length, numberLocale)} />
                <InfoBox label="Courses" value={formatNumber(courseCount, numberLocale)} />
                <InfoBox label="Budget" value={formatCurrency(scope.budgetAmount, numberLocale)} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {scope.selectedCourses.slice(0, 10).map(({ course }) => (
                  <div key={course.id} className="jawraa-subcard p-4">
                    <p className="latin-chip">{course.courseCode}</p>
                    <p className="mt-3 line-clamp-2 text-sm font-semibold text-[var(--ink-strong)]">
                      {course.nameEn || course.nameAr}
                    </p>
                    <p className="mt-2 text-xs text-[var(--ink-soft)]">
                      Package {course.package.code}
                    </p>
                  </div>
                ))}
              </div>

              <div className="jawraa-subcard mt-5 p-4">
                <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--ink-soft)]">
                  <span>Progress</span>
                  <span>{formatNumber(actual, numberLocale)}%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[var(--surface-soft)]">
                  <div
                    className="h-2 rounded-full bg-[var(--brand-yellow)]"
                    style={{ width: `${Math.min(100, Math.max(0, actual))}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="panel-surface">
      <p className="text-sm font-medium text-[var(--ink-soft)]">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="jawraa-subcard p-4">
      <p className="text-xs font-medium text-[var(--ink-soft)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}
