import "server-only";

import { ProjectActivityType, Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import type { Locale } from "@/lib/locale";
import { t } from "@/lib/locale";
import { getProjectDetails } from "@/server/services/project-overview-service";

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  return value === null || value === undefined ? 0 : Number(value);
}

function formatDate(value: Date | null, locale: Locale) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function formatPercent(value: Prisma.Decimal | number, locale: Locale) {
  return `${new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    maximumFractionDigits: 2,
  }).format(decimalToNumber(value))}%`;
}

function formatCurrency(value: Prisma.Decimal | number, locale: Locale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(decimalToNumber(value));
}

function addWorksheet(
  workbook: XLSX.WorkBook,
  name: string,
  rows: Array<Array<string | number>>,
  widths: number[],
  rtl: boolean,
) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = widths.map((wch) => ({ wch }));
  worksheet["!views"] = [{ RTL: rtl }];

  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = worksheet[address];
      if (!cell) continue;

      cell.s = {
        alignment: {
          wrapText: true,
          vertical: "top",
          horizontal: rtl ? "right" : "left",
        },
        border: {
          top: { style: "thin", color: { rgb: "D9D9D9" } },
          bottom: { style: "thin", color: { rgb: "D9D9D9" } },
          left: { style: "thin", color: { rgb: "D9D9D9" } },
          right: { style: "thin", color: { rgb: "D9D9D9" } },
        },
        font: row === 0 || row === 2 ? { bold: true } : undefined,
      };
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
}

export async function buildProjectReportWorkbook(locale: Locale) {
  const labels = t(locale);
  const rtl = locale === "ar";
  const { summary, activities, risks, issues } = await getProjectDetails();

  const activitiesByType = (type: ProjectActivityType) =>
    activities
      .filter((activity) => activity.type === type)
      .map((activity, index) => [index + 1, activity.text]);

  const workbook = XLSX.utils.book_new();
  workbook.Workbook = {
    Views: [{ RTL: rtl }],
  };

  const summaryRows: Array<Array<string | number>> = [
    [labels.excel.reportTitle],
    [],
    [labels.excel.basicInformation, ""],
    [labels.projectOverview.startDate, formatDate(summary.startDate, locale)],
    [labels.projectOverview.expectedEndDate, formatDate(summary.expectedEndDate, locale)],
    [labels.projectOverview.baselineProgress, formatPercent(summary.baselineProgress, locale)],
    [labels.projectOverview.actualProgress, formatPercent(summary.actualProgress, locale)],
    [labels.projectOverview.totalProjectValue, formatCurrency(summary.totalProjectValue, locale)],
    [labels.projectOverview.totalProjectInvoices, formatCurrency(summary.totalProjectInvoices, locale)],
    [labels.projectOverview.totalCollectedValue, formatCurrency(summary.totalCollectedValue, locale)],
    [labels.projectOverview.remainingUnbilledValue, formatCurrency(summary.remainingUnbilledValue, locale)],
    [],
    [labels.excel.previousActivities],
    [labels.excel.number, labels.projectDetails.activityText],
    ...activitiesByType(ProjectActivityType.PREVIOUS),
    [],
    [labels.excel.currentActivities],
    [labels.excel.number, labels.projectDetails.activityText],
    ...activitiesByType(ProjectActivityType.CURRENT),
    [],
    [labels.excel.upcomingActivities],
    [labels.excel.number, labels.projectDetails.activityText],
    ...activitiesByType(ProjectActivityType.UPCOMING),
  ];

  addWorksheet(
    workbook,
    labels.excel.summarySheet,
    summaryRows,
    [16, 55],
    rtl,
  );

  const riskRows: Array<Array<string | number>> = [
    [
      labels.excel.number,
      labels.projectDetails.riskDescription,
      labels.projectDetails.date,
      labels.projectDetails.impact,
      labels.projectDetails.probability,
      labels.projectDetails.owner,
      labels.projectDetails.responsePlan,
      labels.projectDetails.status,
      labels.projectDetails.closureDate,
    ],
    ...risks.map((risk, index) => [
      index + 1,
      risk.description,
      formatDate(risk.date, locale),
      risk.impact,
      risk.probability,
      risk.owner,
      risk.responsePlan,
      risk.status,
      formatDate(risk.closureDate, locale),
    ]),
  ];

  addWorksheet(
    workbook,
    labels.excel.risksSheet,
    riskRows,
    [8, 36, 16, 18, 18, 20, 42, 18, 16],
    rtl,
  );

  const issueRows: Array<Array<string | number>> = [
    [
      labels.excel.number,
      labels.projectDetails.issueDescription,
      labels.projectDetails.date,
      labels.projectDetails.owner,
      labels.projectDetails.responsePlan,
      labels.projectDetails.status,
      labels.projectDetails.closureDate,
    ],
    ...issues.map((issue, index) => [
      index + 1,
      issue.description,
      formatDate(issue.date, locale),
      issue.owner,
      issue.responsePlan,
      issue.status,
      formatDate(issue.closureDate, locale),
    ]),
  ];

  addWorksheet(
    workbook,
    labels.excel.issuesSheet,
    issueRows,
    [8, 40, 16, 20, 42, 18, 16],
    rtl,
  );

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;
}
