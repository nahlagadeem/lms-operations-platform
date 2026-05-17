import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentEntityType, DocumentType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";

type ScopeDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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

function formatFileSize(bytes: number | null, locale: string) {
  if (!bytes) return "-";

  if (bytes < 1024 * 1024) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
  }

  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}

function documentTypeText() {
  return {
    COURSE_CARD: "Course card",
    PRESENTATION: "Presentation",
    LEARNER_GUIDE: "Learner guide",
    ATTENDANCE_SHEET: "Attendance sheet",
    CERTIFICATE_TEMPLATE: "Certificate template",
    QUALITY_REPORT: "Course report",
    FINAL_REPORT: "Final report",
    PHOTOS_ARCHIVE: "Photos archive",
    OTHER: "Other",
  } as Record<DocumentType, string>;
}

export default async function ScopeDetailPage({ params }: ScopeDetailPageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";

  const [scope, documents] = await Promise.all([
    db.projectScope.findUnique({
      where: { id },
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
                category: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    db.document.findMany({
      where: {
        entityType: DocumentEntityType.SCOPE,
        entityId: id,
      },
      orderBy: { uploadedAt: "desc" },
    }),
  ]);

  if (!scope) {
    notFound();
  }

  const courseCount = scope.selectedCourses.length;
  const budget = Number(scope.budgetAmount ?? 0);
  const invoiced = Number(scope.invoicedAmount ?? 0);
  const remaining = Math.max(0, budget - invoiced);
  const actualCompletion = Number(scope.actualCompletion ?? 0);
  const plannedCompletion = Number(scope.plannedCompletion ?? 0);

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/project-structure"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-ink)] hover:underline"
            >
              <span aria-hidden="true">←</span>
              <span>Back to Project Scope</span>
            </Link>
            <p className="eyebrow">Project Scope</p>
            <h2 className="section-title">{scope.name}</h2>
            <p className="section-copy">
              Packages, courses, budget progress, and files related to this project scope.
            </p>
          </div>
          <span className="status-pill">{scope.isActive ? "Available" : "Paused"}</span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Packages" value={formatNumber(scope.packages.length, numberLocale)} />
        <MetricCard title="Courses" value={formatNumber(courseCount, numberLocale)} />
        <MetricCard title="Budget" value={formatCurrency(scope.budgetAmount, numberLocale)} />
        <MetricCard title="Remaining" value={formatCurrency(new Prisma.Decimal(remaining), numberLocale)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="panel-surface">
            <p className="eyebrow">Selected courses</p>
            <h3 className="section-title">Courses in {scope.name}</h3>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {scope.selectedCourses.map(({ course }) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="jawraa-subcard block p-4 transition hover:border-[var(--brand-yellow)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="latin-chip">{course.courseCode}</p>
                      <h4 className="mt-3 text-lg font-semibold text-[var(--ink-strong)]">
                        {course.nameEn || course.nameAr}
                      </h4>
                      <p className="mt-2 text-xs text-[var(--ink-soft)]">
                        Package {course.package.code} | {course.category.nameEn || course.category.nameAr}
                      </p>
                    </div>
                    <span className="status-pill">Available</span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <InfoBox label="Package" value={course.package.code} />
                    <InfoBox label="Duration" value={course.defaultDurationDays ? `${course.defaultDurationDays} days` : "-"} />
                    <InfoBox label="Language" value={course.language || "-"} />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="panel-surface">
            <p className="eyebrow">Budget & Progress</p>
            <h3 className="section-title">Budget & Progress</h3>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <InfoBox title="Budget" label="Total" value={formatCurrency(scope.budgetAmount, numberLocale)} />
              <InfoBox title="Invoiced" label="Submitted" value={formatCurrency(scope.invoicedAmount, numberLocale)} />
              <InfoBox title="Collected" label="Received" value={formatCurrency(scope.collectedAmount, numberLocale)} />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <ProgressBox label="Planned completion" value={plannedCompletion} locale={numberLocale} />
              <ProgressBox label="Actual completion" value={actualCompletion} locale={numberLocale} />
            </div>

            {actualCompletion < plannedCompletion ? (
              <div className="jawraa-subcard mt-5 border-dashed p-4 text-sm font-medium text-[var(--ink-strong)]">
                Delay flag: actual progress is below baseline.
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel-surface">
          <p className="eyebrow">Documents</p>
          <h3 className="section-title">Documents</h3>
          <p className="section-copy">
            Upload files related to this project scope.
          </p>

          <form
            action="/api/project-documents"
            method="post"
            encType="multipart/form-data"
            className="mt-5 space-y-4"
          >
            <input type="hidden" name="entityType" value={DocumentEntityType.SCOPE} />
            <input type="hidden" name="entityId" value={scope.id} />
            <input type="hidden" name="returnPath" value={`/project-structure/scopes/${scope.id}`} />
            <input type="hidden" name="contextLabel" value={`${scope.name} document`} />

            <label className="field-shell">
              <span className="field-label">File type</span>
              <select name="documentType" className="field-input" defaultValue={DocumentType.OTHER}>
                {Object.entries(documentTypeText()).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-shell">
              <span className="field-label">Upload file</span>
              <input
                type="file"
                name="file"
                className="field-input"
                accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.webp,.zip"
              />
            </label>

            <label className="field-shell">
              <span className="field-label">Description or notes</span>
              <textarea name="notes" rows={3} className="field-input min-h-[6rem] resize-y" />
            </label>

            <button type="submit" className="primary-button w-full sm:w-auto">
              Upload File
            </button>
          </form>

          <div className="mt-6 space-y-3">
            {documents.length === 0 ? (
              <div className="jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                No files have been uploaded for this project scope yet.
              </div>
            ) : (
              documents.map((document) => (
                <div key={document.id} className="jawraa-subcard px-4 py-4">
                  <p className="truncate text-sm font-semibold text-[var(--ink-strong)]">
                    {document.originalFileName || document.fileName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink-soft)]">
                    {documentTypeText()[document.documentType]} | Version {document.version} | File size:{" "}
                    {formatFileSize(document.fileSizeBytes, numberLocale)}
                  </p>
                  {document.notes ? (
                    <p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">{document.notes}</p>
                  ) : null}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Link href={document.fileUrl} className="secondary-button w-full sm:w-auto">
                      Download
                    </Link>
                    <form action="/api/project-documents/delete" method="post">
                      <input type="hidden" name="documentId" value={document.id} />
                      <input
                        type="hidden"
                        name="returnPath"
                        value={`/project-structure/scopes/${scope.id}`}
                      />
                      <button type="submit" className="secondary-button w-full sm:w-auto">
                        Delete File
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
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

function InfoBox({
  title,
  label,
  value,
}: {
  title?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="jawraa-subcard p-4">
      {title ? <p className="text-sm font-semibold text-[var(--ink-strong)]">{title}</p> : null}
      <p className="text-xs font-medium text-[var(--ink-soft)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}

function ProgressBox({
  label,
  value,
  locale,
}: {
  label: string;
  value: number;
  locale: string;
}) {
  return (
    <div className="jawraa-subcard p-4">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--ink-soft)]">
        <span>{label}</span>
        <span>{formatNumber(value, locale)}%</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-[var(--surface-soft)]">
        <div
          className="h-2 rounded-full bg-[var(--brand-yellow)]"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
