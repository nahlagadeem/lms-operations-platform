import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type FinancialTotals = {
  revenue: Prisma.Decimal;
  vendorCost: Prisma.Decimal;
  grossMargin: Prisma.Decimal;
  marginPct: number;
};

export type TrainingFinancials = FinancialTotals & {
  courseRunId: string;
  courseId: string;
  pricePerSeat: Prisma.Decimal | null;
  confirmedSeats: number;
};

export type CourseFinancialRollup = {
  course: {
    id: string;
    courseCode: string;
    nameAr: string;
    nameEn: string | null;
  };
  pricePerSeat: Prisma.Decimal | null;
  trainingsCount: number;
  totals: FinancialTotals;
};

export type PackageFinancialRollup = {
  package: {
    id: string;
    code: string;
    nameAr: string;
    nameEn: string | null;
  };
  trainingsCount: number;
  coursesCount: number;
  totals: FinancialTotals;
};

export type ProjectFinancialOverview = {
  trainingsCount: number;
  coursesCount: number;
  packagesCount: number;
  totals: FinancialTotals;
};

type TrainingFinancialRow = {
  id: string;
  confirmedSeats: number;
  vendorCost: Prisma.Decimal | null;
  course: {
    id: string;
    courseCode: string;
    nameAr: string;
    nameEn: string | null;
    package: {
      id: string;
      code: string;
      nameAr: string;
      nameEn: string | null;
    };
    pricingRecords: {
      finalUnitPriceWithoutTax: Prisma.Decimal | null;
    }[];
  };
};

function decimal(value: Prisma.Decimal | number | null | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function getPricePerSeatFromRow(row: TrainingFinancialRow) {
  return row.course.pricingRecords[0]?.finalUnitPriceWithoutTax ?? null;
}

function buildTrainingFinancials(row: TrainingFinancialRow): TrainingFinancials {
  const pricePerSeat = getPricePerSeatFromRow(row);
  const normalizedPricePerSeat = pricePerSeat ?? decimal(0);
  const revenue = normalizedPricePerSeat.mul(row.confirmedSeats);
  const vendorCost = row.vendorCost ?? decimal(0);
  const grossMargin = revenue.sub(vendorCost);

  return {
    courseRunId: row.id,
    courseId: row.course.id,
    pricePerSeat,
    confirmedSeats: row.confirmedSeats,
    revenue,
    vendorCost,
    grossMargin,
    marginPct: revenue.gt(0) ? grossMargin.div(revenue).mul(100).toNumber() : 0,
  };
}

function summarizeFinancials(items: TrainingFinancials[]): FinancialTotals {
  const revenue = items.reduce((sum, item) => sum.add(item.revenue), decimal(0));
  const vendorCost = items.reduce((sum, item) => sum.add(item.vendorCost), decimal(0));
  const grossMargin = revenue.sub(vendorCost);

  return {
    revenue,
    vendorCost,
    grossMargin,
    marginPct: revenue.gt(0) ? grossMargin.div(revenue).mul(100).toNumber() : 0,
  };
}

async function loadTrainingRows(where?: Prisma.CourseRunWhereInput) {
  return db.courseRun.findMany({
    where,
    select: {
      id: true,
      confirmedSeats: true,
      vendorCost: true,
      course: {
        select: {
          id: true,
          courseCode: true,
          nameAr: true,
          nameEn: true,
          package: {
            select: {
              id: true,
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
            },
          },
        },
      },
    },
  });
}

export async function getCurrentPricePerSeat(courseId: string) {
  const pricing = await db.coursePricing.findFirst({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    select: { finalUnitPriceWithoutTax: true },
  });

  return pricing?.finalUnitPriceWithoutTax ?? null;
}

export async function getTrainingFinancials(courseRunId: string): Promise<TrainingFinancials | null> {
  const run = await db.courseRun.findUnique({
    where: { id: courseRunId },
    select: {
      id: true,
      confirmedSeats: true,
      vendorCost: true,
      course: {
        select: {
          id: true,
          pricingRecords: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              finalUnitPriceWithoutTax: true,
            },
          },
        },
      },
    },
  });

  if (!run) return null;

  const pricePerSeat = run.course.pricingRecords[0]?.finalUnitPriceWithoutTax ?? null;
  const normalizedPricePerSeat = pricePerSeat ?? decimal(0);
  const revenue = normalizedPricePerSeat.mul(run.confirmedSeats);
  const vendorCost = run.vendorCost ?? decimal(0);
  const grossMargin = revenue.sub(vendorCost);

  return {
    courseRunId: run.id,
    courseId: run.course.id,
    pricePerSeat,
    confirmedSeats: run.confirmedSeats,
    revenue,
    vendorCost,
    grossMargin,
    marginPct: revenue.gt(0) ? grossMargin.div(revenue).mul(100).toNumber() : 0,
  };
}

export async function getCourseFinancialRollup(courseId: string): Promise<CourseFinancialRollup | null> {
  const rows = await loadTrainingRows({ courseId });
  if (rows.length === 0) return null;

  const financials = rows.map(buildTrainingFinancials);
  const totals = summarizeFinancials(financials);
  const first = rows[0];

  return {
    course: {
      id: first.course.id,
      courseCode: first.course.courseCode,
      nameAr: first.course.nameAr,
      nameEn: first.course.nameEn,
    },
    pricePerSeat: getPricePerSeatFromRow(first),
    trainingsCount: financials.length,
    totals,
  };
}

export async function getPackageFinancialRollup(packageId: string): Promise<PackageFinancialRollup | null> {
  const rows = await loadTrainingRows({
    course: {
      is: {
        packageId,
      },
    },
  });
  if (rows.length === 0) return null;

  const financials = rows.map(buildTrainingFinancials);
  const totals = summarizeFinancials(financials);
  const first = rows[0];
  const courseIds = new Set(rows.map((row) => row.course.id));

  return {
    package: {
      id: first.course.package.id,
      code: first.course.package.code,
      nameAr: first.course.package.nameAr,
      nameEn: first.course.package.nameEn,
    },
    trainingsCount: financials.length,
    coursesCount: courseIds.size,
    totals,
  };
}

export async function getProjectFinancialOverview(): Promise<ProjectFinancialOverview> {
  const rows = await loadTrainingRows();
  const financials = rows.map(buildTrainingFinancials);
  const totals = summarizeFinancials(financials);
  const courseIds = new Set(rows.map((row) => row.course.id));
  const packageIds = new Set(rows.map((row) => row.course.package.id));

  return {
    trainingsCount: financials.length,
    coursesCount: courseIds.size,
    packagesCount: packageIds.size,
    totals,
  };
}
