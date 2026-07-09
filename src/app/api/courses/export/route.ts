import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { isAuthenticated } from "@/lib/auth";
import { getLocale, t } from "@/lib/locale";
import { loadCourseCatalogRows } from "@/server/services/catalog-table-service";

function normalize(value: string | null) {
  return value?.trim() || "";
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const locale = await getLocale();
  const labels = t(locale);
  const search = normalize(request.nextUrl.searchParams.get("q"));
  const packageCode = normalize(request.nextUrl.searchParams.get("package"));
  const deliveryType = normalize(request.nextUrl.searchParams.get("type"));
  const searchKey = search.toLowerCase();

  const rows = (await loadCourseCatalogRows(locale, { activeOnly: true })).filter((row) => {
    if (packageCode && row.packageCode !== packageCode) return false;
    if (deliveryType && row.deliveryType !== deliveryType) return false;
    if (!searchKey) return true;

    return [
      row.courseCode,
      row.nameAr,
      row.nameEn,
      row.packageCode,
      row.packageDisplayName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(searchKey);
  });

  const headers: string[] = [
    labels.courses.course,
    labels.courses.package,
    labels.courses.estimatedSeats,
    labels.courses.actualSeats,
    labels.courses.remainingSeats,
    labels.courses.fulfillmentPct,
    labels.courses.linkedTrainings,
    labels.courses.duration,
  ];

  const bodyRows = rows.map((row) => [
    locale === "ar" ? `${row.courseCode} ${row.nameAr || row.nameEn || ""}`.trim() : `${row.courseCode} ${row.nameEn || row.nameAr || ""}`.trim(),
    row.packageDisplayName,
    row.estimatedSeats,
    row.actualSeats,
    row.remainingSeats,
    `${new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { maximumFractionDigits: 2 }).format(row.fulfillmentPct)}%`,
    row.linkedTrainingsCount,
    row.durationLabel,
  ]);

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...bodyRows]);
  worksheet["!cols"] = [{ wch: 24 }, { wch: 34 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Courses");

  const body = new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  const fileName = locale === "ar" ? "الدورات" : "courses";

  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`)}`,
      "Cache-Control": "no-store",
    },
  });
}
