import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { ActiveStatus, DeliveryType, Prisma } from "@prisma/client";

type SummaryRow = {
  packageCode: string;
  expectedTraineeCount: number | null;
  originalTotalAmount: number | null;
  discountedTotalAmount: number | null;
};

type PackageDefinition = {
  packageCode: string;
  packageNameAr: string;
  categoryCode: string;
  categoryNameAr: string;
  deliveryType: DeliveryType;
};

const PACKAGE_DEFINITIONS: Record<string, PackageDefinition> = {
  "1": {
    packageCode: "PKG-001",
    packageNameAr: "الحزمة الأولى",
    categoryCode: "leadership-programs",
    categoryNameAr: "برامج قيادية",
    deliveryType: DeliveryType.TRAINING,
  },
  "2": {
    packageCode: "PKG-002",
    packageNameAr: "الحزمة الثانية",
    categoryCode: "professional-certifications",
    categoryNameAr: "برامج الشهادات الاحترافية",
    deliveryType: DeliveryType.CERTIFICATION,
  },
  "3": {
    packageCode: "PKG-003",
    packageNameAr: "الحزمة الثالثة",
    categoryCode: "business-self-development",
    categoryNameAr: "برامج تطوير الذات ومهارات الأعمال",
    deliveryType: DeliveryType.TRAINING,
  },
  "4": {
    packageCode: "PKG-004",
    packageNameAr: "الحزمة الرابعة",
    categoryCode: "english-programs",
    categoryNameAr: "دورات اللغة الأنجليزية",
    deliveryType: DeliveryType.LANGUAGE,
  },
  "5": {
    packageCode: "PKG-005",
    packageNameAr: "الحزمة الخامسة",
    categoryCode: "conferences-workshops",
    categoryNameAr: "المؤتمرات والمعارض وورش العمل",
    deliveryType: DeliveryType.CONFERENCE,
  },
};

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeNullableText(value: unknown): string | null {
  const text = normalizeText(value);
  return text || null;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDecimal(value: number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  return new Prisma.Decimal(value);
}

function buildCourseCode(packageCode: string, rowIndex: number): string {
  return `${packageCode}-${String(rowIndex).padStart(4, "0")}`;
}

function readSummaryRows(workbook: XLSX.WorkBook): SummaryRow[] {
  const sheet = workbook.Sheets["ملخص المشروع"];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });

  return rows
    .slice(2)
    .map((row) => ({
      packageCode: normalizeText(row[0]),
      expectedTraineeCount: parseNumber(row[1]),
      originalTotalAmount: parseNumber(row[2]),
      discountedTotalAmount: parseNumber(row[3]),
    }))
    .filter((row) => /^[1-5]$/.test(row.packageCode));
}

export async function loadWorkbookFromExcel(workbookPath: string) {
  const buffer = await readFile(workbookPath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const summaryRows = readSummaryRows(workbook);

  const packageResults: {
    packageCode: string;
    packageNameAr: string;
    courseCount: number;
  }[] = [];

  let totalCoursesImported = 0;

  for (const summaryRow of summaryRows) {
    const definition = PACKAGE_DEFINITIONS[summaryRow.packageCode];
    if (!definition) continue;

    const category = await db.courseCategory.upsert({
      where: { code: definition.categoryCode },
      update: {
        nameAr: definition.categoryNameAr,
      },
      create: {
        code: definition.categoryCode,
        nameAr: definition.categoryNameAr,
      },
    });

    const pkg = await db.package.upsert({
      where: { code: definition.packageCode },
      update: {
        nameAr: definition.packageNameAr,
        expectedTraineeCount: summaryRow.expectedTraineeCount,
        originalTotalAmount: toDecimal(summaryRow.originalTotalAmount),
        discountedTotalAmount: toDecimal(summaryRow.discountedTotalAmount),
      },
      create: {
        code: definition.packageCode,
        nameAr: definition.packageNameAr,
        expectedTraineeCount: summaryRow.expectedTraineeCount,
        originalTotalAmount: toDecimal(summaryRow.originalTotalAmount),
        discountedTotalAmount: toDecimal(summaryRow.discountedTotalAmount),
      },
    });

    const sheet = workbook.Sheets[summaryRow.packageCode];
    if (!sheet) {
      packageResults.push({
        packageCode: definition.packageCode,
        packageNameAr: definition.packageNameAr,
        courseCount: 0,
      });
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
    });

    let packageCourseCount = 0;

    for (const row of rows.slice(1)) {
      const serialNumber = normalizeText(row[0]);
      const packageNameAr = normalizeText(row[1]);
      const courseNameAr = normalizeText(row[2]);

      if (!serialNumber || !courseNameAr || !packageNameAr) continue;

      const unitOfMeasure = normalizeNullableText(row[3]);
      const description = normalizeNullableText(row[5]);
      const specification = normalizeNullableText(row[6]);
      const originalUnitPriceWithTax = parseNumber(row[7]);
      const originalUnitPriceWithoutTax = parseNumber(row[8]);
      const discountPercentage = parseNumber(row[9]);
      const discountAmount = parseNumber(row[10]);
      const finalUnitPriceWithoutTax = parseNumber(row[11]);

      const durationMatch = specification?.match(/(\d+)/);
      const defaultDurationDays = durationMatch ? Number(durationMatch[1]) : null;

      const courseCode = buildCourseCode(definition.packageCode, Number(serialNumber));

      const course = await db.course.upsert({
        where: { courseCode },
        update: {
          packageId: pkg.id,
          categoryId: category.id,
          nameAr: courseNameAr,
          description,
          deliveryType: definition.deliveryType,
          unitOfMeasure,
          defaultDurationDays,
          language: definition.deliveryType === DeliveryType.LANGUAGE ? "English" : "Arabic",
          activeStatus: ActiveStatus.ACTIVE,
          requiresCertificate: definition.deliveryType === DeliveryType.CERTIFICATION,
          requiresProviderRegistration:
            definition.deliveryType === DeliveryType.CERTIFICATION ||
            definition.deliveryType === DeliveryType.CONFERENCE,
        },
        create: {
          packageId: pkg.id,
          categoryId: category.id,
          courseCode,
          nameAr: courseNameAr,
          nameEn: null,
          description: [description, specification].filter(Boolean).join(" | ") || null,
          deliveryType: definition.deliveryType,
          unitOfMeasure,
          defaultDurationDays,
          language: definition.deliveryType === DeliveryType.LANGUAGE ? "English" : "Arabic",
          isExternal: definition.deliveryType === DeliveryType.CONFERENCE,
          requiresCertificate: definition.deliveryType === DeliveryType.CERTIFICATION,
          requiresProviderRegistration:
            definition.deliveryType === DeliveryType.CERTIFICATION ||
            definition.deliveryType === DeliveryType.CONFERENCE,
          activeStatus: ActiveStatus.ACTIVE,
        },
      });

      const existingPricing = await db.coursePricing.findFirst({
        where: {
          courseId: course.id,
          effectiveFrom: null,
          effectiveTo: null,
        },
      });

      const pricingData = {
        originalUnitPriceWithTax: toDecimal(originalUnitPriceWithTax),
        originalUnitPriceWithoutTax: toDecimal(originalUnitPriceWithoutTax),
        discountPercentage:
          discountPercentage !== null ? toDecimal(discountPercentage) : null,
        discountAmount: toDecimal(discountAmount),
        finalUnitPriceWithoutTax: toDecimal(finalUnitPriceWithoutTax),
        currencyCode: "SAR",
      };

      if (existingPricing) {
        await db.coursePricing.update({
          where: { id: existingPricing.id },
          data: pricingData,
        });
      } else {
        await db.coursePricing.create({
          data: {
            courseId: course.id,
            ...pricingData,
          },
        });
      }

      packageCourseCount += 1;
      totalCoursesImported += 1;
    }

    packageResults.push({
      packageCode: definition.packageCode,
      packageNameAr: definition.packageNameAr,
      courseCount: packageCourseCount,
    });
  }

  return {
    importedPackages: packageResults.length,
    importedCourses: totalCoursesImported,
    packages: packageResults,
  };
}
