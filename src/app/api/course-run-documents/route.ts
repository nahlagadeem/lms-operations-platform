import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { DocumentEntityType, DocumentType } from "@prisma/client";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveDocumentUpload } from "@/server/services/document-upload-service";

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeReturnPath(value: string, courseRunId: string) {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return courseRunId ? `/trainings/${courseRunId}` : "/trainings";
}

function redirectWithStatus(request: NextRequest, returnPath: string, status: string) {
  const url = new URL(returnPath, request.url);
  url.searchParams.set("upload", status);

  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    return redirectWithStatus(request, "/trainings", "invalid");
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return redirectWithStatus(request, "/trainings", "invalid");
  }

  const courseRunId = normalizeText(formData.get("courseRunId"));
  const documentType = normalizeText(formData.get("documentType")) as DocumentType;
  const notes = normalizeText(formData.get("notes"));
  const returnPath = safeReturnPath(normalizeText(formData.get("returnPath")), courseRunId);
  const file = formData.get("file");

  if (!courseRunId || !Object.values(DocumentType).includes(documentType) || !(file instanceof File)) {
    return redirectWithStatus(request, returnPath, "invalid");
  }

  const runExists = await db.courseRun.findUnique({
    where: { id: courseRunId },
    select: { id: true },
  });

  if (!runExists) {
    return redirectWithStatus(request, "/trainings", "missing");
  }

  try {
    await saveDocumentUpload({
      entityType: DocumentEntityType.COURSE_RUN,
      entityId: courseRunId,
      documentType,
      file,
      contextLabel: "Training file",
      notes,
    });
  } catch {
    return redirectWithStatus(request, returnPath, "invalid");
  }

  revalidatePath("/trainings");
  revalidatePath(returnPath);

  return NextResponse.redirect(new URL(returnPath, request.url), 303);
}
