import * as XLSX from "xlsx";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

type ExportRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export async function GET(_request: Request, { params }: ExportRouteProps) {
  await requireAuth();
  const { id } = await params;

  const training = await db.courseRun.findUnique({
    where: { id },
    select: {
      runCode: true,
      nominations: {
        include: { participant: true },
        orderBy: [{ nominatedAt: "desc" }],
      },
    },
  });

  if (!training) notFound();

  const rows = training.nominations.map((nomination) => ({
    "Training Code": training.runCode,
    "Attendee Name": nomination.participant.fullNameEn || nomination.participant.fullNameAr,
    "Arabic Name": nomination.participant.fullNameAr || "",
    "English Name": nomination.participant.fullNameEn || "",
    Email: nomination.participant.email || "",
    Phone: nomination.participant.phone || "",
    Organization: nomination.participant.organizationName || "",
    "Job Title": nomination.participant.jobTitle || "",
    "Participant Type": nomination.participant.participantType,
    "Enrollment Status": nomination.nominationStatus,
    "Enrollment Date": formatDate(nomination.nominatedAt),
    Notes: nomination.notes || "",
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 28 },
    { wch: 28 },
    { wch: 30 },
    { wch: 18 },
    { wch: 28 },
    { wch: 24 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 36 },
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Enrollments");

  const body = new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${training.runCode}-enrollments.xlsx`)}`,
      "Cache-Control": "no-store",
    },
  });
}
