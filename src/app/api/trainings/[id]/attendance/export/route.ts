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

function sessionDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(_request: Request, { params }: ExportRouteProps) {
  await requireAuth();
  const { id } = await params;

  const training = await db.courseRun.findUnique({
    where: { id },
    select: {
      runCode: true,
      sessions: {
        orderBy: { sessionDate: "asc" },
      },
      nominations: {
        include: { participant: true },
        orderBy: [{ nominatedAt: "desc" }],
      },
      attendanceRecords: true,
    },
  });

  if (!training) notFound();

  const sessionIdByDate = new Map(
    training.sessions.map((session) => [sessionDateKey(session.sessionDate), session.id]),
  );
  const attendanceByCell = new Map<string, (typeof training.attendanceRecords)[number]>();

  for (const record of training.attendanceRecords) {
    const sessionId =
      record.trainingSessionId ?? sessionIdByDate.get(sessionDateKey(record.attendanceDate));
    if (!sessionId) continue;
    const key = `${record.participantId}:${sessionId}`;
    if (!attendanceByCell.has(key)) {
      attendanceByCell.set(key, record);
    }
  }

  const rows = training.nominations.flatMap((nomination) =>
    training.sessions.map((session) => {
      const record = attendanceByCell.get(`${nomination.participantId}:${session.id}`);
      return {
        "Training Code": training.runCode,
        "Attendee Name": nomination.participant.fullNameEn || nomination.participant.fullNameAr,
        Email: nomination.participant.email || "",
        Organization: nomination.participant.organizationName || "",
        "Session Date": formatDate(session.sessionDate),
        Status: record?.attendanceStatus ?? "NOT_RECORDED",
        Notes: record?.notes ?? "",
        "Recorded At": formatDate(record?.recordedAt),
      };
    }),
  );

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 30 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 36 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

  const body = new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${training.runCode}-attendance.xlsx`)}`,
      "Cache-Control": "no-store",
    },
  });
}
