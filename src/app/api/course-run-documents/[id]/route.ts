import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

type DownloadRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: DownloadRouteProps) {
  const { id } = await params;
  const document = await db.document.findUnique({
    where: { id },
    select: {
      fileName: true,
      originalFileName: true,
      storagePath: true,
      mimeType: true,
    },
  });

  if (!document?.storagePath) {
    notFound();
  }

  const uploadsRoot = path.join(process.cwd(), "uploads");
  const normalizedStoragePath = path.normalize(document.storagePath);

  if (
    normalizedStoragePath === "uploads" ||
    !normalizedStoragePath.startsWith(`uploads${path.sep}`)
  ) {
    notFound();
  }

  const absolutePath = path.join(
    process.cwd(),
    "uploads",
    normalizedStoragePath.slice(`uploads${path.sep}`.length),
  );

  if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    notFound();
  }

  try {
    const fileBuffer = await readFile(absolutePath);
    const downloadName = encodeURIComponent(
      document.originalFileName || document.fileName,
    );

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${downloadName}`,
        "Content-Length": String(fileBuffer.byteLength),
      },
    });
  } catch {
    notFound();
  }
}
