import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { isAuthenticated } from "@/lib/auth";
import { getLocale, t } from "@/lib/locale";
import { canViewFinancials, getCurrentPlatformRole } from "@/lib/permissions";
import { loadCourseCatalogRows } from "@/server/services/catalog-table-service";

function normalize(value: string | null) {
  return value?.trim() || "";
}

function formatPercent(value: number, locale: string) {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}%`;
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const locale = await getLocale();
  const labels = t(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";
  const role = await getCurrentPlatformRole();
  const canSeeFinancials = canViewFinancials(role);
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
    labels.courses.code,
    labels.courses.name,
    labels.courses.package,
    labels.courses.estimatedSeats,
    labels.courses.actualSeats,
    labels.courses.remainingSeats,
    labels.courses.fulfillmentPct,
    labels.courses.linkedTrainings,
    labels.courses.daysHeld,
  ];

  const bodyRows = rows.map((row) => {
    const values: Array<string | number> = [
      row.courseCode,
      locale === "ar" ? row.nameAr || row.nameEn || row.courseCode : row.nameEn || row.nameAr || row.courseCode,
      row.packageDisplayName,
      row.estimatedSeats,
      row.actualSeats,
      row.remainingSeats,
      formatPercent(row.fulfillmentPct, numberLocale),
      row.linkedTrainingsCount,
      row.durationLabel,
    ];

    if (canSeeFinancials) {
      values.push(row.pricePerSeatLabel);
    }

    return values;
  });

  if (canSeeFinancials) {
    headers.push(labels.courses.pricePerSeat);
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...bodyRows]);
  worksheet["!cols"] = canSeeFinancials
    ? [{ wch: 20 }, { wch: 34 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }]
    : [{ wch: 20 }, { wch: 34 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
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
