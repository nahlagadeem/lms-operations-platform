import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { DocumentEntityType } from "@prisma/client";
import { db } from "@/lib/db";

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

export async function POST(request: NextRequest) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.redirect(new URL("/project-structure?delete=invalid", request.url), 303);
  }

  const documentId = normalizeText(formData.get("documentId"));
  const returnPath = safeReturnPath(normalizeText(formData.get("returnPath")));

  if (!documentId) {
    return NextResponse.redirect(new URL(`${returnPath}?delete=invalid`, request.url), 303);
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
    return NextResponse.redirect(new URL(`${returnPath}?delete=missing`, request.url), 303);
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

  return NextResponse.redirect(new URL(returnPath, request.url), 303);
}
