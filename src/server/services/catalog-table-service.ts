import "server-only";

import { ActiveStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/locale";
import { formatPackageDisplayName } from "@/lib/package-display";

type DecimalLike = Prisma.Decimal | number | null | undefined;

function decimalToNumber(value: DecimalLike) {
  return value === null || value === undefined ? 0 : Number(value);
}

function formatNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrency(value: DecimalLike, locale: Locale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(decimalToNumber(value));
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function normalizeName(nameEn: string | null, nameAr: string | null, fallback: string) {
  return nameEn || nameAr || fallback;
}

function formatDurationLabel(
  days: number | null,
  hours: number | null,
  locale: Locale,
) {
  const dayLabel = locale === "ar" ? "يوم" : "day";
  const daysLabel = locale === "ar" ? "أيام" : "days";
  const hourLabel = locale === "ar" ? "ساعة" : "hour";
  const hoursLabel = locale === "ar" ? "ساعات" : "hours";
  const parts: string[] = [];

  if (days) {
    parts.push(`${days} ${days === 1 ? dayLabel : daysLabel}`);
  }

  if (hours) {
    parts.push(`${hours} ${hours === 1 ? hourLabel : hoursLabel}`);
  }

  return parts.length > 0 ? parts.join(" / ") : (locale === "ar" ? "غير محدد" : "Unspecified");
}

export type PackageCatalogRow = {
  id: string;
  code: string;
  nameAr: string | null;
  nameEn: string | null;
  description: string | null;
  courseCount: number;
  estimatedSeats: number;
  actualSeats: number;
  remainingSeats: number;
  utilizationPct: number;
  grossMarginPct: number | null;
  displayName: string;
};

export type CourseCatalogRow = {
  id: string;
  courseCode: string;
  nameAr: string;
  nameEn: string | null;
  packageCode: string;
  packageNameAr: string | null;
  packageNameEn: string | null;
  packageDisplayName: string;
  deliveryType: string;
  durationDays: number | null;
  durationHours: number | null;
  estimatedSeats: number;
  actualSeats: number;
  remainingSeats: number;
  fulfillmentPct: number;
  linkedTrainingsCount: number;
  pricePerSeat: Prisma.Decimal | null;
  pricePerSeatLabel: string;
  durationLabel: string;
};

export async function loadPackageCatalogRows(locale: Locale): Promise<PackageCatalogRow[]> {
  const packages = await db.package.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      nameAr: true,
      nameEn: true,
      description: true,
      courses: {
        select: {
          pricingRecords: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { finalUnitPriceWithoutTax: true },
          },
          runs: {
            select: {
              confirmedSeats: true,
              vendorCost: true,
            },
          },
          scopeSelections: {
            select: {
              estimatedSeats: true,
            },
          },
        },
      },
    },
  });

  return packages.map((item) => {
    const estimatedSeats = item.courses.reduce(
      (sum, course) =>
        sum +
        course.scopeSelections.reduce(
          (entrySum, entry) => entrySum + (entry.estimatedSeats ?? 0),
          0,
        ),
      0,
    );
    const actualSeats = item.courses.reduce(
      (sum, course) =>
        sum + course.runs.reduce((entrySum, run) => entrySum + run.confirmedSeats, 0),
      0,
    );
    const revenue = item.courses.reduce((sum, course) => {
      const price = decimalToNumber(course.pricingRecords[0]?.finalUnitPriceWithoutTax);
      return (
        sum +
        price * course.runs.reduce((seatSum, run) => seatSum + run.confirmedSeats, 0)
      );
    }, 0);
    const vendorCost = item.courses.reduce(
      (sum, course) =>
        sum +
        course.runs.reduce((entrySum, run) => entrySum + decimalToNumber(run.vendorCost), 0),
      0,
    );

    return {
      id: item.id,
      code: item.code,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      description: item.description,
      courseCount: item.courses.length,
      estimatedSeats,
      actualSeats,
      remainingSeats: estimatedSeats - actualSeats,
      utilizationPct: ratio(actualSeats, estimatedSeats),
      grossMarginPct: revenue > 0 ? ratio(revenue - vendorCost, revenue) : null,
      displayName: formatPackageDisplayName(item, locale),
    };
  });
}

export async function loadCourseCatalogRows(
  locale: Locale,
  options?: {
    activeOnly?: boolean;
  },
): Promise<CourseCatalogRow[]> {
  const courses = await db.course.findMany({
    where: options?.activeOnly === false ? undefined : { activeStatus: ActiveStatus.ACTIVE },
    orderBy: [{ package: { code: "asc" } }, { courseCode: "asc" }],
    select: {
      id: true,
      courseCode: true,
      nameAr: true,
      nameEn: true,
      defaultDurationDays: true,
      defaultDurationHours: true,
      deliveryType: true,
      package: {
        select: {
          code: true,
          nameAr: true,
          nameEn: true,
        },
      },
      pricingRecords: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          finalUnitPriceWithoutTax: true,
          currencyCode: true,
        },
      },
      runs: {
        select: {
          confirmedSeats: true,
        },
      },
      scopeSelections: {
        select: {
          estimatedSeats: true,
        },
      },
    },
  });

  return courses.map((course) => {
    const estimatedSeats = course.scopeSelections.reduce(
      (sum, entry) => sum + (entry.estimatedSeats ?? 0),
      0,
    );
    const actualSeats = course.runs.reduce((sum, run) => sum + run.confirmedSeats, 0);
    const pricePerSeat = course.pricingRecords[0]?.finalUnitPriceWithoutTax ?? null;

    return {
      id: course.id,
      courseCode: course.courseCode,
      nameAr: course.nameAr,
      nameEn: course.nameEn,
      packageCode: course.package.code,
      packageNameAr: course.package.nameAr,
      packageNameEn: course.package.nameEn,
      packageDisplayName: formatPackageDisplayName(course.package, locale),
      deliveryType: course.deliveryType,
      durationDays: course.defaultDurationDays,
      durationHours: course.defaultDurationHours,
      estimatedSeats,
      actualSeats,
      remainingSeats: estimatedSeats - actualSeats,
      fulfillmentPct: ratio(actualSeats, estimatedSeats),
      linkedTrainingsCount: course.runs.length,
      pricePerSeat,
      pricePerSeatLabel: formatCurrency(pricePerSeat, locale),
      durationLabel: formatDurationLabel(course.defaultDurationDays, course.defaultDurationHours, locale),
    };
  });
}

export function courseDisplayName(row: Pick<CourseCatalogRow, "courseCode" | "nameAr" | "nameEn">, locale: Locale) {
  const name = locale === "ar" ? row.nameAr || row.nameEn : row.nameEn || row.nameAr;
  return `${row.courseCode} ${name || ""}`.trim();
}

export function packageDisplayName(row: Pick<PackageCatalogRow, "code" | "nameAr" | "nameEn">, locale: Locale) {
  return formatPackageDisplayName(row, locale);
}
