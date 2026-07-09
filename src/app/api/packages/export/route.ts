import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { isAuthenticated } from "@/lib/auth";
import { getLocale, t } from "@/lib/locale";
import { canViewFinancials, getCurrentPlatformRole } from "@/lib/permissions";
import { loadPackageCatalogRows } from "@/server/services/catalog-table-service";

function normalize(value: string | null) {
  return value?.trim() || "";
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const locale = await getLocale();
  const labels = t(locale);
  const role = await getCurrentPlatformRole();
  const canSeeFinancials = canViewFinancials(role);
  const search = normalize(request.nextUrl.searchParams.get("q"));
  const searchKey = search.toLowerCase();

  const rows = (await loadPackageCatalogRows(locale)).filter((item) => {
    if (!searchKey) return true;
    return [item.code, item.displayName, item.nameAr, item.nameEn, item.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(searchKey);
  });

  const headers: string[] = [
    labels.packages.package,
    labels.packages.totalCourses,
    labels.packages.estimatedSeats,
    labels.packages.actualSeats,
    labels.packages.remainingSeats,
    labels.packages.seatUtilizationPct,
  ];

  if (canSeeFinancials) {
    headers.push(labels.packages.grossMarginPct);
  }

  const bodyRows = rows.map((row) => [
    row.displayName,
    row.courseCount,
    row.estimatedSeats,
    row.actualSeats,
    row.remainingSeats,
    `${new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { maximumFractionDigits: 2 }).format(row.utilizationPct)}%`,
    ...(canSeeFinancials
      ? [
          row.grossMarginPct === null
            ? "-"
            : `${new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { maximumFractionDigits: 2 }).format(row.grossMarginPct)}%`,
        ]
      : []),
  ]);

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...bodyRows]);
  worksheet["!cols"] = canSeeFinancials
    ? [{ wch: 34 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
    : [{ wch: 34 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Packages");

  const body = new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  const fileName = locale === "ar" ? "الحزم" : "packages";

  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`)}`,
      "Cache-Control": "no-store",
    },
  });
}
