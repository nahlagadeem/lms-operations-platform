import { getLocale, t } from "@/lib/locale";
import { requireAuth } from "@/lib/auth";
import { canViewFinancials, getCurrentPlatformRole } from "@/lib/permissions";
import { buildProjectReportWorkbook } from "@/server/services/project-report-export-service";

export async function GET() {
  await requireAuth();
  if (!canViewFinancials(await getCurrentPlatformRole())) {
    return Response.json({ message: "Forbidden." }, { status: 403 });
  }

  const locale = await getLocale();
  const labels = t(locale);
  const workbook = await buildProjectReportWorkbook(locale);
  const body = new Uint8Array(workbook);
  const fileName = `${labels.excel.fileName}.xlsx`;

  return new Response(body, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
