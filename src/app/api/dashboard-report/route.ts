import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getLocale, t } from "@/lib/locale";
import {
  formatReportingDate,
  getProjectReportingRows,
} from "@/server/services/project-reporting-service";

function normalize(value: string | null) {
  return value?.trim() || "";
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const locale = await getLocale();
  const labels = t(locale);
  const search = request.nextUrl.searchParams;
  const rows = await getProjectReportingRows(locale, {
    q: normalize(search.get("q")),
    category: normalize(search.get("category")),
  });

  const header = [
    labels.reporting.number,
    labels.reporting.category,
    labels.reporting.nameDescription,
    labels.reporting.relatedCourseProject,
    labels.reporting.ownerResponsible,
    labels.reporting.status,
    labels.reporting.date,
    labels.reporting.notes,
  ];

  const csvRows = rows.map((row, index) =>
    [
      index + 1,
      row.categoryLabel,
      row.name,
      row.related,
      row.owner,
      row.status,
      formatReportingDate(row.date, locale),
      row.notes,
    ]
      .map(csvCell)
      .join(","),
  );

  const csv = `\uFEFF${[header.map(csvCell).join(","), ...csvRows].join("\r\n")}`;
  const fileName = locale === "ar" ? "تقارير-المشروع" : "project-reporting";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${fileName}-${new Date().toISOString().slice(0, 10)}.csv`)}`,
    },
  });
}
