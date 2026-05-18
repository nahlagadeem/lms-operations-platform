import "server-only";

import { DocumentEntityType, DocumentType } from "@prisma/client";
import { db } from "@/lib/db";
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
      contextLabel: `${createdScope.name} document`,
      notes: input.notes,
    });
  }

  return createdScope;
}

export async function updateProjectScope(input: UpdateProjectScopeInput) {
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
      contextLabel: `${updatedScope.name} document`,
      notes: input.notes,
    });
  }

  return updatedScope;
}

export async function replaceProjectScopeCourses(scopeId: string, courseIds: string[]) {
  const uniqueCourseIds = Array.from(new Set(courseIds.filter(Boolean)));

  await db.$transaction([
    db.projectScopeCourse.deleteMany({
      where: { scopeId },
    }),
    ...(uniqueCourseIds.length > 0
      ? [
          db.projectScopeCourse.createMany({
            data: uniqueCourseIds.map((courseId, index) => ({
              scopeId,
              courseId,
              sortOrder: index + 1,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
}

export async function removeProjectScopeCourse(scopeId: string, courseId: string) {
  await db.projectScopeCourse.deleteMany({
    where: {
      scopeId,
      courseId,
    },
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
