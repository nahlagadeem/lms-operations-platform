import * as XLSX from "xlsx";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

type ExportRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(_request: Request, { params }: ExportRouteProps) {
  await requireAuth();
  const { id } = await params;

  const training = await db.courseRun.findUnique({
    where: { id },
    select: {
      runCode: true,
      certificateRequired: true,
      sessions: { orderBy: { sessionDate: "asc" } },
      nominations: {
        include: { participant: true },
        orderBy: [{ nominatedAt: "desc" }],
      },
      attendanceRecords: true,
    },
  });

  if (!training) notFound();

  const sessionIdByDate = new Map(
    training.sessions.map((session) => [dateKey(session.sessionDate), session.id]),
  );
  const attendanceByCell = new Map<string, (typeof training.attendanceRecords)[number]>();

  for (const record of training.attendanceRecords) {
    const sessionId = record.trainingSessionId ?? sessionIdByDate.get(dateKey(record.attendanceDate));
    if (!sessionId) continue;
    const key = `${record.participantId}:${sessionId}`;
    if (!attendanceByCell.has(key)) {
      attendanceByCell.set(key, record);
    }
  }

  const totalSessions = training.sessions.length;
  const threshold = 0.75;
  const rows = training.nominations.map((nomination) => {
    const attendedSessions = training.sessions.reduce((count, session) => {
      const record = attendanceByCell.get(`${nomination.participantId}:${session.id}`);
      return record?.attendanceStatus === "PRESENT" ? count + 1 : count;
    }, 0);
    const attendanceRate = totalSessions > 0 ? attendedSessions / totalSessions : 0;
    const completionEligible = attendanceRate >= threshold;
    const certificateEligible = training.certificateRequired
      ? completionEligible
      : true;

    return {
      "Training Code": training.runCode,
      "Attendee Name": nomination.participant.fullNameEn || nomination.participant.fullNameAr,
      Email: nomination.participant.email || "",
      Organization: nomination.participant.organizationName || "",
      "Attended Sessions": attendedSessions,
      "Total Sessions": totalSessions,
      "Attendance Rate %": Math.round(attendanceRate * 100),
      "Completion Eligible": completionEligible ? "Yes" : "No",
      "Certificate Eligible": certificateEligible ? "Yes" : "No",
    };
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 30 },
    { wch: 28 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Completion");

  const body = new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${training.runCode}-completion.xlsx`)}`,
      "Cache-Control": "no-store",
    },
  });
}
