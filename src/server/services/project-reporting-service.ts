import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/locale";
import { t } from "@/lib/locale";
import { getProjectSummary } from "@/server/services/project-overview-service";

export type ReportingCategory =
  | "PROJECT"
  | "COURSE"
  | "COURSE_RUN"
  | "TRAINER"
  | "PARTICIPANT"
  | "LOCATION"
  | "PROVIDER"
  | "DOCUMENT";

export type ReportingRow = {
  id: string;
  category: ReportingCategory;
  categoryLabel: string;
  name: string;
  related: string;
  owner: string;
  status: string;
  statusValue: string;
  date: Date | null;
  notes: string;
};

export type ReportingFilters = {
  q?: string;
  category?: string;
};

function normalize(value?: string | null) {
  return value?.trim() || "";
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  return value === null || value === undefined ? 0 : Number(value);
}

function formatDate(value: Date | null, locale: Locale) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

function formatCurrency(value: Prisma.Decimal | number, locale: Locale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(decimalToNumber(value));
}

function formatPercent(value: Prisma.Decimal | number, locale: Locale) {
  return `${new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    maximumFractionDigits: 1,
  }).format(decimalToNumber(value))}%`;
}

export function getReportingCategoryOptions(locale: Locale) {
  const labels = t(locale);
  return [
    { value: "PROJECT", label: labels.reporting.categories.project },
    { value: "COURSE", label: labels.reporting.categories.course },
    { value: "COURSE_RUN", label: labels.reporting.categories.courseRun },
    { value: "TRAINER", label: labels.reporting.categories.trainer },
    { value: "PARTICIPANT", label: labels.reporting.categories.participant },
    { value: "LOCATION", label: labels.reporting.categories.location },
    { value: "PROVIDER", label: labels.reporting.categories.provider },
    { value: "DOCUMENT", label: labels.reporting.categories.document },
  ];
}

function categoryLabel(category: ReportingCategory, locale: Locale) {
  return (
    getReportingCategoryOptions(locale).find((item) => item.value === category)?.label ??
    category
  );
}

function matchesSearch(row: ReportingRow, q: string) {
  if (!q) return true;
  const haystack = [
    row.categoryLabel,
    row.name,
    row.related,
    row.owner,
    row.status,
    row.notes,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q.toLowerCase());
}

export async function getProjectReportingRows(
  locale: Locale,
  filters: ReportingFilters = {},
) {
  const labels = t(locale);
  const q = normalize(filters.q);
  const category = normalize(filters.category) as ReportingCategory | "";

  const [
    summary,
    courses,
    courseRuns,
    trainers,
    participants,
    locations,
    providers,
    documents,
  ] = await Promise.all([
    getProjectSummary(),
    db.course.findMany({
      include: {
        package: { select: { code: true, nameAr: true, nameEn: true } },
        category: { select: { nameAr: true, nameEn: true } },
      },
      orderBy: { courseCode: "asc" },
      take: 120,
    }),
    db.courseRun.findMany({
      include: {
        course: { select: { courseCode: true, nameAr: true, nameEn: true } },
        provider: { select: { nameAr: true, nameEn: true } },
        location: { select: { nameAr: true, nameEn: true, city: true } },
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      take: 120,
    }),
    db.trainer.findMany({
      include: { provider: { select: { nameAr: true, nameEn: true } } },
      orderBy: { updatedAt: "desc" },
      take: 80,
    }),
    db.participant.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.location.findMany({
      orderBy: { updatedAt: "desc" },
      take: 80,
    }),
    db.provider.findMany({
      orderBy: { updatedAt: "desc" },
      take: 80,
    }),
    db.document.findMany({
      orderBy: { uploadedAt: "desc" },
      take: 80,
    }),
  ]);

  const rows: ReportingRow[] = [
    {
      id: "project-summary",
      category: "PROJECT",
      categoryLabel: categoryLabel("PROJECT", locale),
      name: labels.home.projectSummary,
      related: labels.excel.reportTitle,
      owner: "-",
      status: `${labels.projectOverview.actualProgress}: ${formatPercent(summary.actualProgress, locale)}`,
      statusValue: "PROJECT_SUMMARY",
      date: summary.updatedAt,
      notes: [
        `${labels.projectOverview.startDate}: ${formatDate(summary.startDate, locale)}`,
        `${labels.projectOverview.expectedEndDate}: ${formatDate(summary.expectedEndDate, locale)}`,
        `${labels.projectOverview.baselineProgress}: ${formatPercent(summary.baselineProgress, locale)}`,
        `${labels.projectOverview.totalProjectValue}: ${formatCurrency(summary.totalProjectValue, locale)}`,
        `${labels.projectOverview.totalProjectInvoices}: ${formatCurrency(summary.totalProjectInvoices, locale)}`,
        `${labels.projectOverview.totalCollectedValue}: ${formatCurrency(summary.totalCollectedValue, locale)}`,
        `${labels.projectOverview.remainingUnbilledValue}: ${formatCurrency(summary.remainingUnbilledValue, locale)}`,
      ].join(" | "),
    },
    ...courses.map((course): ReportingRow => ({
      id: `course-${course.id}`,
      category: "COURSE",
      categoryLabel: categoryLabel("COURSE", locale),
      name: `${course.courseCode} - ${course.nameEn || course.nameAr}`,
      related: course.package.nameEn || course.package.nameAr,
      owner: "-",
      status: labels.deliveryTypes[course.deliveryType],
      statusValue: course.deliveryType,
      date: course.updatedAt,
      notes: course.category.nameEn || course.category.nameAr,
    })),
    ...courseRuns.map((run): ReportingRow => ({
      id: `run-${run.id}`,
      category: "COURSE_RUN",
      categoryLabel: categoryLabel("COURSE_RUN", locale),
      name: `${run.runCode} - ${run.course.nameEn || run.course.nameAr}`,
      related: run.course.courseCode,
      owner: run.provider?.nameEn || run.provider?.nameAr || "-",
      status: labels.courseRunStatuses[run.status],
      statusValue: run.status,
      date: run.startDate ?? run.updatedAt,
      notes: [
        run.location?.nameEn || run.location?.nameAr || run.location?.city,
        `${run.confirmedSeats}/${run.plannedSeats ?? 0}`,
      ]
        .filter(Boolean)
        .join(" | "),
    })),
    ...trainers.map((trainer): ReportingRow => ({
      id: `trainer-${trainer.id}`,
      category: "TRAINER",
      categoryLabel: categoryLabel("TRAINER", locale),
      name: trainer.fullNameEn || trainer.fullNameAr,
      related: trainer.specialization || "-",
      owner: trainer.provider?.nameEn || trainer.provider?.nameAr || "-",
      status: trainer.isApproved ? labels.reporting.statuses.approved : labels.reporting.statuses.pending,
      statusValue: trainer.isApproved ? "APPROVED" : "PENDING",
      date: trainer.updatedAt,
      notes: trainer.email || trainer.phone || "",
    })),
    ...participants.map((participant): ReportingRow => ({
      id: `participant-${participant.id}`,
      category: "PARTICIPANT",
      categoryLabel: categoryLabel("PARTICIPANT", locale),
      name: participant.fullNameEn || participant.fullNameAr,
      related: participant.organizationName || participant.department || "-",
      owner: participant.jobTitle || "-",
      status: participant.isActive ? labels.reporting.statuses.active : labels.reporting.statuses.inactive,
      statusValue: participant.isActive ? "ACTIVE" : "INACTIVE",
      date: participant.updatedAt,
      notes: participant.email || participant.phone || "",
    })),
    ...locations.map((location): ReportingRow => ({
      id: `location-${location.id}`,
      category: "LOCATION",
      categoryLabel: categoryLabel("LOCATION", locale),
      name: location.nameEn || location.nameAr,
      related: location.city || location.country || "-",
      owner: "-",
      status: location.isActive ? labels.reporting.statuses.active : labels.reporting.statuses.inactive,
      statusValue: location.isActive ? "ACTIVE" : "INACTIVE",
      date: location.updatedAt,
      notes: location.venueName || location.roomName || location.address || "",
    })),
    ...providers.map((provider): ReportingRow => ({
      id: `provider-${provider.id}`,
      category: "PROVIDER",
      categoryLabel: categoryLabel("PROVIDER", locale),
      name: provider.nameEn || provider.nameAr,
      related: provider.city || provider.country || "-",
      owner: provider.contactPerson || "-",
      status: provider.isActive ? labels.reporting.statuses.active : labels.reporting.statuses.inactive,
      statusValue: provider.isActive ? "ACTIVE" : "INACTIVE",
      date: provider.updatedAt,
      notes: provider.email || provider.phone || provider.website || "",
    })),
    ...documents.map((document): ReportingRow => ({
      id: `document-${document.id}`,
      category: "DOCUMENT",
      categoryLabel: categoryLabel("DOCUMENT", locale),
      name: document.title || document.originalFileName || document.fileName,
      related: `${document.entityType} ${document.entityId}`,
      owner: document.uploadedByUserId || "-",
      status: document.documentType,
      statusValue: document.documentType,
      date: document.uploadedAt,
      notes: document.contextLabel || document.notes || "",
    })),
  ];

  return rows
    .filter((row) => (!category ? true : row.category === category))
    .filter((row) => matchesSearch(row, q));
}

export function formatReportingDate(value: Date | null, locale: Locale) {
  return formatDate(value, locale);
}
