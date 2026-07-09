import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { isAuthenticated } from "@/lib/auth";
import { getLocale, t } from "@/lib/locale";
import { canViewFinancials, getCurrentPlatformRole } from "@/lib/permissions";
import { formatPurchaseOrderCode, formatPurchaseOrderTitle } from "@/lib/purchase-order";
import { db } from "@/lib/db";

function normalize(value: string | null) {
  return value?.trim() || "";
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatPercent(value: number, locale: string) {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}%`;
}

function formatCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function countAssignedPackages(selectedCourses: Array<{ course: { package: { id: string } } }>) {
  return new Set(selectedCourses.map((selection) => selection.course.package.id)).size;
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
  const poSearch = normalize(request.nextUrl.searchParams.get("q"));
  const courseSearch = normalize(request.nextUrl.searchParams.get("courseQ"));
  const courseSearchKey = courseSearch.toLowerCase();

  const scopes = await db.projectScope.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      nameAr: true,
      nameEn: true,
      description: true,
      region: true,
      budgetAmount: true,
      selectedCourses: {
        select: {
          estimatedSeats: true,
          courseRuns: {
            select: { confirmedSeats: true },
          },
          course: {
            select: {
              id: true,
              courseCode: true,
              nameAr: true,
              nameEn: true,
              package: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  const filteredScopes = scopes.filter((scope) => {
    const poMatches = [
      formatPurchaseOrderCode(scope.code, locale),
      formatPurchaseOrderTitle(scope, locale),
      scope.description,
      scope.region,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(poSearch.toLowerCase());

    const courseMatches = !courseSearchKey
      ? true
      : scope.selectedCourses.some((entry) =>
          [
            entry.course.courseCode,
            entry.course.nameAr,
            entry.course.nameEn,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(courseSearchKey),
        );

    return poMatches && courseMatches;
  });

  const headers: string[] = [
    labels.projectScopes.scope,
    labels.projectScopes.courses,
    labels.projectScopes.packages,
    labels.projectScopes.estimatedSeats,
    labels.projectScopes.actualSeats,
    labels.projectScopes.remainingSeats,
    labels.projectScopes.fulfillmentPct,
  ];

  if (canSeeFinancials) {
    headers.push(labels.projectScopes.budget);
  }

  const rows = filteredScopes.map((scope) => {
    const courseCount = scope.selectedCourses.length;
    const totalEstimatedSeats = scope.selectedCourses.reduce(
      (sum, entry) => sum + (entry.estimatedSeats ?? 0),
      0,
    );
    const totalActualSeats = scope.selectedCourses.reduce(
      (sum, entry) =>
        sum + entry.courseRuns.reduce((runSum, run) => runSum + run.confirmedSeats, 0),
      0,
    );
    const fulfillmentPct = totalEstimatedSeats > 0 ? (totalActualSeats / totalEstimatedSeats) * 100 : 0;
    const values: Array<string | number> = [
      `${formatPurchaseOrderCode(scope.code, locale)} ${formatPurchaseOrderTitle(scope, locale)}`.trim(),
      courseCount,
      countAssignedPackages(scope.selectedCourses),
      totalEstimatedSeats,
      totalActualSeats,
      totalEstimatedSeats - totalActualSeats,
      formatPercent(fulfillmentPct, numberLocale),
    ];

    if (canSeeFinancials) {
      values.push(formatCurrency(Number(scope.budgetAmount ?? 0), numberLocale));
    }

    return values;
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet["!cols"] = canSeeFinancials
    ? [{ wch: 36 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
    : [{ wch: 36 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, "POs");

  const body = new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  const fileName = locale === "ar" ? "أوامر-الشراء" : "purchase-orders";

  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`)}`,
      "Cache-Control": "no-store",
    },
  });
}
