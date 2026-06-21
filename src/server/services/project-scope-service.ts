import "server-only";

import { DocumentEntityType, DocumentType } from "@prisma/client";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { formatPurchaseOrderTitle } from "@/lib/purchase-order";
import { saveDocumentUpload } from "@/server/services/document-upload-service";

export type CreateProjectScopeInput = {
  code: string;
  nameAr: string;
  nameEn: string;
  description: string;
  region: string;
  isActive: boolean;
  startDate: Date | null;
  expectedEndDate: Date | null;
  notes: string;
  courseIds: string[];
  file?: File | null;
};

export type UpdateProjectScopeInput = CreateProjectScopeInput & {
  id: string;
};

export async function createProjectScope(input: CreateProjectScopeInput) {
  const locale = await getLocale();
  const createdScope = await db.projectScope.create({
    data: {
      code: input.code,
      name: input.nameEn || input.nameAr,
      description: input.description || null,
      isActive: input.isActive,
      plannedCompletion: 0,
      actualCompletion: 0,
      budgetAmount: 0,
      invoicedAmount: 0,
      collectedAmount: 0,
    },
  });

  await updateProjectScopeDetails(createdScope.id, input);
  await replaceProjectScopeCourses(createdScope.id, input.courseIds);

  if (input.file && input.file.size > 0) {
    await saveDocumentUpload({
      entityType: DocumentEntityType.SCOPE,
      entityId: createdScope.id,
      documentType: DocumentType.OTHER,
      file: input.file,
      contextLabel: `${formatPurchaseOrderTitle(createdScope, locale)} document`,
      notes: input.notes,
    });
  }

  return createdScope;
}

export async function updateProjectScope(input: UpdateProjectScopeInput) {
  const locale = await getLocale();
  const updatedScope = await db.projectScope.update({
    where: { id: input.id },
    data: {
      code: input.code,
      name: input.nameEn || input.nameAr,
      description: input.description || null,
      isActive: input.isActive,
    },
  });

  await updateProjectScopeDetails(updatedScope.id, input);

  if (input.file && input.file.size > 0) {
    await saveDocumentUpload({
      entityType: DocumentEntityType.SCOPE,
      entityId: updatedScope.id,
      documentType: DocumentType.OTHER,
      file: input.file,
      contextLabel: `${formatPurchaseOrderTitle(updatedScope, locale)} document`,
      notes: input.notes,
    });
  }

  return updatedScope;
}

export async function replaceProjectScopeCourses(scopeId: string, courseIds: string[]) {
  const uniqueCourseIds = Array.from(new Set(courseIds.filter(Boolean)));

  await db.$transaction(async (tx) => {
    const existingEntries = await tx.projectScopeCourse.findMany({
      where: { scopeId },
      select: { id: true, courseId: true },
    });
    const retainedCourseIds = new Set(uniqueCourseIds);
    const removedEntryIds = existingEntries
      .filter((entry) => !retainedCourseIds.has(entry.courseId))
      .map((entry) => entry.id);

    if (removedEntryIds.length > 0) {
      await tx.courseRun.updateMany({
        where: { projectScopeCourseId: { in: removedEntryIds } },
        data: { projectScopeId: null, projectScopeCourseId: null },
      });
      await tx.projectScopeCourse.deleteMany({
        where: { id: { in: removedEntryIds } },
      });
    }

    for (const [index, courseId] of uniqueCourseIds.entries()) {
      await tx.projectScopeCourse.upsert({
        where: { scopeId_courseId: { scopeId, courseId } },
        update: { sortOrder: index + 1 },
        create: { scopeId, courseId, sortOrder: index + 1 },
      });
    }
  });
}

export async function removeProjectScopeCourse(scopeId: string, courseId: string) {
  await db.$transaction(async (tx) => {
    const entry = await tx.projectScopeCourse.findUnique({
      where: { scopeId_courseId: { scopeId, courseId } },
      select: { id: true },
    });
    if (!entry) return;

    await tx.courseRun.updateMany({
      where: { projectScopeCourseId: entry.id },
      data: { projectScopeId: null, projectScopeCourseId: null },
    });
    await tx.projectScopeCourse.delete({ where: { id: entry.id } });
  });
}

export async function updatePurchaseOrderCourseEntryEstimatedSeats(
  purchaseOrderId: string,
  purchaseOrderCourseEntryId: string,
  estimatedSeats: number | null,
) {
  const result = await db.projectScopeCourse.updateMany({
    where: { id: purchaseOrderCourseEntryId, scopeId: purchaseOrderId },
    data: { estimatedSeats },
  });

  if (result.count !== 1) {
    throw new Error("Purchase Order Course Entry was not found.");
  }

  await db.courseRun.updateMany({
    where: { projectScopeCourseId: purchaseOrderCourseEntryId },
    data: { plannedSeats: estimatedSeats },
  });
}

export async function deleteProjectScope(id: string) {
  await db.$transaction([
    db.document.deleteMany({
      where: {
        entityType: DocumentEntityType.SCOPE,
        entityId: id,
      },
    }),
    db.projectScope.delete({
      where: { id },
    }),
  ]);
}

async function updateProjectScopeDetails(
  id: string,
  input: Pick<
    CreateProjectScopeInput,
    "nameAr" | "nameEn" | "region" | "startDate" | "expectedEndDate" | "notes"
  >,
) {
  await db.$executeRaw`
    UPDATE "ProjectScope"
    SET
      "nameAr" = ${input.nameAr || null},
      "nameEn" = ${input.nameEn || null},
      "region" = ${input.region || null},
      "startDate" = ${input.startDate},
      "expectedEndDate" = ${input.expectedEndDate},
      "notes" = ${input.notes || null}
    WHERE "id" = ${id}
  `;
}
