import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { DocumentEntityType, DocumentType } from "@prisma/client";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canEditOperationalData,
  getCurrentPlatformRole,
} from "@/lib/permissions";
import { saveDocumentUpload } from "@/server/services/document-upload-service";

const projectDocumentTypes = new Set<DocumentEntityType>([
  DocumentEntityType.SCOPE,
  DocumentEntityType.PACKAGE,
]);

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeReturnPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/project-structure";
}

function redirectWithStatus(request: NextRequest, returnPath: string, status: string) {
  const url = new URL(returnPath, request.url);
  url.searchParams.set("upload", status);

  return NextResponse.redirect(url, 303);
}

async function assertEntityExists(entityType: DocumentEntityType, entityId: string) {
  if (entityType === DocumentEntityType.SCOPE) {
    return db.projectScope.findUnique({ where: { id: entityId }, select: { id: true } });
  }

  if (entityType === DocumentEntityType.PACKAGE) {
    return db.package.findUnique({ where: { id: entityId }, select: { id: true } });
  }

  return null;
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }
  if (!canEditOperationalData(await getCurrentPlatformRole())) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    return redirectWithStatus(request, "/project-structure", "invalid");
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return redirectWithStatus(request, "/project-structure", "invalid");
  }

  const entityType = normalizeText(formData.get("entityType")) as DocumentEntityType;
  const entityId = normalizeText(formData.get("entityId"));
  const documentType = normalizeText(formData.get("documentType")) as DocumentType;
  const returnPath = safeReturnPath(normalizeText(formData.get("returnPath")));
  const contextLabel = normalizeText(formData.get("contextLabel"));
  const notes = normalizeText(formData.get("notes"));
  const file = formData.get("file");

  if (
    !projectDocumentTypes.has(entityType) ||
    !entityId ||
    !Object.values(DocumentType).includes(documentType) ||
    !(file instanceof File)
  ) {
    return redirectWithStatus(request, returnPath, "invalid");
  }

  const entityExists = await assertEntityExists(entityType, entityId);

  if (!entityExists) {
    return redirectWithStatus(request, "/project-structure", "missing");
  }

  try {
    await saveDocumentUpload({
      entityType,
      entityId,
      documentType,
      file,
      contextLabel,
      notes,
    });
  } catch {
    return redirectWithStatus(request, returnPath, "invalid");
  }

  revalidatePath("/project-structure");
  revalidatePath(returnPath);

  return NextResponse.redirect(new URL(returnPath, request.url), 303);
}

export async function DELETE(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }
  if (!canEditOperationalData(await getCurrentPlatformRole())) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  let payload: {
    documentId?: string;
    returnPath?: string;
  };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid delete request." }, { status: 400 });
  }

  const documentId = typeof payload.documentId === "string" ? payload.documentId.trim() : "";
  const returnPath = safeReturnPath(typeof payload.returnPath === "string" ? payload.returnPath.trim() : "");

  if (!documentId) {
    return NextResponse.json({ message: "Missing document id." }, { status: 400 });
  }

  const document = await db.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      entityType: true,
      storagePath: true,
    },
  });

  if (!document || !projectDocumentTypes.has(document.entityType)) {
    return NextResponse.json({ message: "Document was not found." }, { status: 404 });
  }

  await db.document.delete({ where: { id: document.id } });

  if (document.storagePath) {
    const uploadsRoot = path.join(process.cwd(), "uploads");
    const normalizedStoragePath = path.normalize(document.storagePath);
    const uploadsPrefix = `uploads${path.sep}`;

    if (normalizedStoragePath.startsWith(uploadsPrefix)) {
      const absolutePath = path.join(uploadsRoot, normalizedStoragePath.slice(uploadsPrefix.length));
      await unlink(absolutePath).catch(() => undefined);
    }
  }

  revalidatePath("/project-structure");
  revalidatePath(returnPath);

  return NextResponse.json({ ok: true });
}
