import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DocumentEntityType, DocumentType } from "@prisma/client";
import { db } from "@/lib/db";

export const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024;

export const allowedDocumentUploadMimeTypes = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type DocumentUploadInput = {
  entityType: DocumentEntityType;
  entityId: string;
  documentType: DocumentType;
  file: File;
  contextLabel?: string;
  notes?: string;
};

function sanitizeFileName(fileName: string) {
  const extension = path.extname(fileName);
  const baseName = path
    .basename(fileName, extension)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `${baseName || "document"}${extension.toLowerCase()}`;
}

export function validateDocumentUpload(file: File) {
  if (file.size === 0) {
    throw new Error("Upload a file before submitting.");
  }

  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    throw new Error("File is too large. Maximum file size is 20 MB.");
  }

  if (!allowedDocumentUploadMimeTypes.has(file.type)) {
    throw new Error("Unsupported file type. Upload PDF, Excel, Word, image, or ZIP files.");
  }
}

export async function saveDocumentUpload({
  entityType,
  entityId,
  documentType,
  file,
  contextLabel,
  notes,
}: DocumentUploadInput) {
  validateDocumentUpload(file);

  const latestVersion = await db.document.findFirst({
    where: {
      entityType,
      entityId,
      documentType,
      originalFileName: file.name,
    },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latestVersion?.version ?? 0) + 1;
  const safeName = sanitizeFileName(file.name);
  const storedFileName = `${Date.now()}-v${version}-${safeName}`;
  const relativeStoragePath = path.join(
    "uploads",
    "documents",
    entityType,
    entityId,
    storedFileName,
  );
  const absoluteStoragePath = path.join(process.cwd(), relativeStoragePath);

  await mkdir(path.dirname(absoluteStoragePath), { recursive: true });
  await writeFile(absoluteStoragePath, Buffer.from(await file.arrayBuffer()));

  const createdDocument = await db.document.create({
    data: {
      entityType,
      entityId,
      documentType,
      contextLabel: contextLabel || null,
      fileName: safeName,
      originalFileName: file.name,
      fileUrl: "pending",
      storagePath: relativeStoragePath,
      mimeType: file.type,
      fileSizeBytes: file.size,
      version,
      notes: notes || null,
    },
  });

  await db.document.update({
    where: { id: createdDocument.id },
    data: {
      fileUrl: `/api/documents/${createdDocument.id}`,
    },
  });

  return createdDocument.id;
}
