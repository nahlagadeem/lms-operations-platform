import Link from "next/link";
import { notFound } from "next/navigation";
import { ActiveStatus, CourseRunStatus, DeliveryMode, Prisma } from "@prisma/client";
import { createCourseRun } from "@/app/course-runs/actions";
import { db } from "@/lib/db";
import { getLocale, t } from "@/lib/locale";

type CourseDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    panel?: string;
  }>;
};

function detailText(locale: "en" | "ar") {
  if (locale === "ar") {
    return {
      title: "تفاصيل الدورة",
      description:
        "هذه بطاقة الدورة الأساسية قبل التشغيل. راجع المعلومات ثم ابدأ نسخة تشغيلية وحدد حالتها وتفاصيلها التنفيذية.",
      back: "العودة إلى الدورات",
      createRun: "إنشاء تشغيل للدورة",
      createRunButton: "فتح إنشاء التشغيل",
      close: "إغلاق",
      overview: "نظرة عامة",
      planning: "التخطيط والتشغيل",
      pricing: "التسعير",
      relatedRuns: "التشغيلات المرتبطة",
      noRuns: "لا توجد تشغيلات مرتبطة بهذه الدورة حتى الآن.",
      descriptionLabel: "وصف الدورة",
      noDescription: "لا يوجد وصف متاح لهذه الدورة حالياً.",
      package: "الحزمة",
      category: "التصنيف",
      code: "كود الدورة",
      type: "نوع البرنامج",
      duration: "المدة",
      language: "اللغة",
      unit: "وحدة القياس",
      activeStatus: "حالة السجل",
      attendance: "يتطلب حضور",
      certificate: "يتطلب شهادة",
      providerRegistration: "يتطلب تسجيل جهة",
      external: "تنفيذ خارجي",
      targetUse: "الاستخدام التشغيلي",
      startOperationalNote:
        "يمكن من هذه الصفحة تحويل الدورة إلى تشغيل فعلي ثم استكمال المدرب والموقع والجدولة.",
      latestPrice: "السعر النهائي الحالي",
      originalPrice: "السعر الأصلي",
      discountAmount: "قيمة الخصم",
      discountPercentage: "نسبة الخصم",
      unavailable: "غير متوفر",
      unspecified: "غير محدد",
      yes: "نعم",
      no: "لا",
      countRuns: "إجمالي التشغيلات",
      countOngoing: "الجارية",
      countCompleted: "المكتملة",
      createDescription:
        "ابدأ تشغيل هذه الدورة مباشرة من هنا. يمكنك اعتبارها جارية الآن أو اختيار حالة تشغيل أخرى ثم متابعة التفاصيل.",
      status: "الحالة",
      deliveryMode: "نمط التنفيذ",
      startDate: "تاريخ البداية",
      endDate: "تاريخ النهاية",
      plannedSeats: "المقاعد المخططة",
      notes: "ملاحظات",
      notesPlaceholder: "ملاحظات تشغيلية داخلية",
      startNow: "بدء التشغيل",
      runCode: "كود التشغيل",
      dates: "التواريخ",
      noDates: "التواريخ غير محددة",
      openRun: "فتح التشغيل",
    };
  }

  return {
    title: "Course details",
    description:
      "Review the course information, then add an active course and set the course status from here.",
    back: "Back to courses",
    createRun: "Add Active Course",
    createRunButton: "Add Active Course",
    close: "Close",
    overview: "Course overview",
    planning: "Planning and operations",
    pricing: "Pricing snapshot",
    relatedRuns: "Related active courses",
    noRuns: "No active courses are linked to this course yet. Click Add Active Course to get started.",
    descriptionLabel: "Course description",
    noDescription: "No description is available for this course yet.",
    package: "Package",
    category: "Category",
    code: "Course code",
    type: "Program type",
    duration: "Duration",
    language: "Language",
    unit: "Unit of measure",
    activeStatus: "Course availability",
    attendance: "Attendance required",
    certificate: "Issue certificate",
    providerRegistration: "Training provider registration",
    external: "External delivery",
    targetUse: "Operational use",
    startOperationalNote:
      "From this page, add an active course, then complete the trainer, location, and schedule details.",
    latestPrice: "Current final price",
    originalPrice: "Original price",
    discountAmount: "Discount amount",
    discountPercentage: "Discount percentage",
    unavailable: "Not available",
    unspecified: "Unspecified",
    yes: "Yes",
    no: "No",
    countRuns: "Total active courses",
    countOngoing: "In progress",
    countCompleted: "Completed",
    createDescription:
      "Add an active course directly from here. You can mark it as in progress immediately or choose another course status first.",
    status: "Status",
    deliveryMode: "Delivery mode",
    startDate: "Start date",
    endDate: "End date",
    plannedSeats: "Planned seats",
    notes: "Notes",
    notesPlaceholder: "Internal operational notes",
    startNow: "Add Course",
    runCode: "Course Session",
    dates: "Dates",
    noDates: "Dates not set",
    openRun: "View Details",
  };
}

function formatCurrency(
  value: Prisma.Decimal | null | undefined,
  currencyCode: string,
  locale: string,
  unavailableLabel: string,
) {
  if (!value) {
    return unavailableLabel;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDateRange(
  startDate: Date | null,
  endDate: Date | null,
  locale: string,
  emptyLabel: string,
) {
  if (!startDate && !endDate) {
    return emptyLabel;
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  if (startDate && endDate) {
    return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
  }

  return formatter.format(startDate ?? endDate!);
}

function formatDuration(
  days: number | null,
  hours: number | null,
  labels: {
    unspecified: string;
    day: string;
    days: string;
    hour: string;
    hours: string;
  },
) {
  const parts: string[] = [];

  if (days) {
    parts.push(`${days} ${days === 1 ? labels.day : labels.days}`);
  }

  if (hours) {
    parts.push(`${hours} ${hours === 1 ? labels.hour : labels.hours}`);
  }

  return parts.length > 0 ? parts.join(" / ") : labels.unspecified;
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function courseAvailabilityText(status: ActiveStatus, details: { unavailable: string }) {
  if (status === ActiveStatus.ACTIVE) return "Available";
  if (status === ActiveStatus.ARCHIVED) return "Archived";
  return details.unavailable;
}

function panelHref(id: string) {
  return `/courses/${id}?panel=create-run`;
}

export default async function CourseDetailPage({
  params,
  searchParams,
}: CourseDetailPageProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const openPanel = query.panel === "create-run";
  const locale = await getLocale();
  const localeText = t(locale);
  const details = detailText(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";

  const course = await db.course.findUnique({
    where: { id },
    include: {
      package: true,
      category: true,
      pricingRecords: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      runs: {
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        include: {
          provider: {
            select: {
              nameAr: true,
              nameEn: true,
            },
          },
          location: {
            select: {
              nameAr: true,
              nameEn: true,
            },
          },
        },
        take: 12,
      },
      _count: {
        select: {
          runs: true,
        },
      },
    },
  });

  if (!course) {
    notFound();
  }

  const latestPricing = course.pricingRecords[0];
  const ongoingRuns = course.runs.filter((run) => run.status === CourseRunStatus.ONGOING).length;
  const completedRuns = course.runs.filter((run) => run.status === CourseRunStatus.COMPLETED).length;
  const durationLabel = formatDuration(course.defaultDurationDays, course.defaultDurationHours, {
    unspecified: details.unspecified,
    day: localeText.units.day,
    days: localeText.units.days,
    hour: localeText.units.hour,
    hours: localeText.units.hours,
  });

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/courses"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-ink)] hover:underline"
            >
              <span aria-hidden="true">←</span>
              <span>{details.back}</span>
            </Link>
            <p className="eyebrow">{details.title}</p>
            <h2 className="section-title">
              {course.courseCode} | {course.nameEn || course.nameAr}
            </h2>
            <p className="section-copy">{details.description}</p>
          </div>

          <Link href={panelHref(course.id)} className="primary-button w-full sm:w-auto">
            {details.createRun}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={details.countRuns}
          value={formatNumber(course._count.runs, numberLocale)}
        />
        <MetricCard
          title={details.countOngoing}
          value={formatNumber(ongoingRuns, numberLocale)}
        />
        <MetricCard
          title={details.countCompleted}
          value={formatNumber(completedRuns, numberLocale)}
        />
        <MetricCard
          title={details.latestPrice}
          value={formatCurrency(
            latestPricing?.finalUnitPriceWithoutTax,
            latestPricing?.currencyCode || "SAR",
            numberLocale,
            details.unavailable,
          )}
        />
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6 min-w-0">
          <div className="panel-surface">
            <p className="eyebrow">{details.overview}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <InfoCard label={details.package} value={course.package.nameEn || course.package.nameAr} />
              <InfoCard label={details.category} value={course.category.nameEn || course.category.nameAr} />
              <InfoCard label={details.code} value={course.courseCode} mono />
              <InfoCard label={details.type} value={localeText.deliveryTypes[course.deliveryType]} />
              <InfoCard label={details.duration} value={durationLabel} />
              <InfoCard label={details.language} value={course.language || details.unspecified} />
              <InfoCard label={details.unit} value={course.unitOfMeasure || details.unspecified} />
              <InfoCard label={details.activeStatus} value={courseAvailabilityText(course.activeStatus, details)} />
            </div>

            <div className="jawraa-subcard mt-5 p-4">
              <p className="text-xs font-medium text-[var(--ink-soft)]">
                {details.descriptionLabel}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-strong)]">
                {course.description || details.noDescription}
              </p>
            </div>
          </div>

          <div className="panel-surface">
            <p className="eyebrow">{details.relatedRuns}</p>
            <div className="mt-5 space-y-3">
              {course.runs.length === 0 ? (
                <div className="jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                  {details.noRuns}
                </div>
              ) : (
                course.runs.map((run) => (
                  <Link
                    key={run.id}
                    href={`/course-runs/${run.id}`}
                    className="jawraa-subcard block px-4 py-4 transition hover:shadow-[0_12px_28px_rgba(17,17,17,0.06)]"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="latin-cell text-sm font-semibold text-[var(--brand-ink)]">
                          {run.runCode}
                        </p>
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">
                          {formatDateRange(
                            run.startDate,
                            run.endDate,
                            numberLocale,
                            details.noDates,
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="status-pill">
                          {localeText.courseRunStatuses[run.status]}
                        </span>
                        <span className="text-xs font-medium text-[var(--ink-soft)]">
                          {details.openRun}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 min-w-0">
          <div className="panel-surface">
            <p className="eyebrow">{details.planning}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <ProgressCard
                label={details.attendance}
                value={details.yes}
                tone="teal"
              />
              <ProgressCard
                label={details.certificate}
                value={course.requiresCertificate ? details.yes : details.no}
                tone="sand"
              />
              <ProgressCard
                label={details.providerRegistration}
                value={course.requiresProviderRegistration ? details.yes : details.no}
                tone="ink"
              />
              <ProgressCard
                label={details.external}
                value={course.isExternal ? details.yes : details.no}
                tone="teal"
              />
            </div>

            <div className="jawraa-subcard mt-5 p-5">
              <p className="text-xs font-medium text-[var(--ink-soft)]">{details.targetUse}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-strong)]">
                {details.startOperationalNote}
              </p>
            </div>
          </div>

          <div className="panel-surface">
            <p className="eyebrow">{details.pricing}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <InfoCard
                label={details.latestPrice}
                value={formatCurrency(
                  latestPricing?.finalUnitPriceWithoutTax,
                  latestPricing?.currencyCode || "SAR",
                  numberLocale,
                  details.unavailable,
                )}
              />
              <InfoCard
                label={details.originalPrice}
                value={formatCurrency(
                  latestPricing?.originalUnitPriceWithoutTax,
                  latestPricing?.currencyCode || "SAR",
                  numberLocale,
                  details.unavailable,
                )}
              />
              <InfoCard
                label={details.discountAmount}
                value={formatCurrency(
                  latestPricing?.discountAmount,
                  latestPricing?.currencyCode || "SAR",
                  numberLocale,
                  details.unavailable,
                )}
              />
              <InfoCard
                label={details.discountPercentage}
                value={
                  latestPricing?.discountPercentage
                    ? `${Number(latestPricing.discountPercentage) * 100}%`
                    : details.unavailable
                }
              />
            </div>
          </div>
        </div>
      </section>

      {openPanel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,25,35,0.55)] p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_30px_70px_rgba(10,25,35,0.35)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{details.createRun}</p>
                <h3 className="section-title">{details.createRunButton}</h3>
              </div>
              <Link href={`/courses/${course.id}`} className="secondary-button">
                {details.close}
              </Link>
            </div>

            <p className="section-copy">{details.createDescription}</p>

            <form action={createCourseRun} className="mt-6 space-y-4">
              <input type="hidden" name="courseId" value={course.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-shell">
                  <span className="field-label">{details.status}</span>
                  <select
                    name="status"
                    className="field-input"
                    defaultValue={CourseRunStatus.ONGOING}
                  >
                    {Object.entries(localeText.courseRunStatuses).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell">
                  <span className="field-label">{details.deliveryMode}</span>
                  <select
                    name="deliveryMode"
                    className="field-input"
                    defaultValue={DeliveryMode.IN_PERSON}
                  >
                    {Object.entries(localeText.deliveryModes).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-shell">
                  <span className="field-label">{details.startDate}</span>
                  <input type="date" name="startDate" className="field-input" />
                </label>

                <label className="field-shell">
                  <span className="field-label">{details.endDate}</span>
                  <input type="date" name="endDate" className="field-input" />
                </label>
              </div>

              <label className="field-shell">
                <span className="field-label">{details.plannedSeats}</span>
                <input
                  type="number"
                  name="plannedSeats"
                  min="0"
                  step="1"
                  className="field-input"
                />
              </label>

              <label className="field-shell">
                <span className="field-label">{details.notes}</span>
                <textarea
                  name="notes"
                  rows={5}
                  placeholder={details.notesPlaceholder}
                  className="field-input min-h-[8rem] resize-y"
                />
              </label>

              <button type="submit" className="primary-button w-full sm:w-auto">
                {details.startNow}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <article className="jawraa-card p-5">
      <p className="text-sm font-medium text-[var(--ink-soft)]">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--ink-strong)]">{value}</p>
    </article>
  );
}

function InfoCard({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="jawraa-subcard p-4">
      <p className="text-xs font-medium text-[var(--ink-soft)]">{label}</p>
      <p
        className={`mt-2 text-sm font-semibold leading-7 text-[var(--ink-strong)] ${mono ? "latin-cell" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function ProgressCard({
  label,
  value,
}: {
  label: string;
  value: string;
  tone: "teal" | "sand" | "ink";
}) {
  return (
    <div className="jawraa-subcard p-4">
      <p className="text-xs font-medium text-[var(--ink-soft)]">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}
