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
      trainingEvaluations: {
        include: {
          participant: true,
          subjectInstructor: true,
          evaluatorInstructor: true,
        },
        orderBy: [{ evaluationType: "asc" }, { updatedAt: "desc" }],
      },
    },
  });

  if (!training) notFound();

  const rows = training.trainingEvaluations.map((evaluation) => ({
    "Training Code": training.runCode,
    "Evaluation Type": evaluation.evaluationType,
    "Attendee Name": evaluation.participant.fullNameEn || evaluation.participant.fullNameAr,
    Email: evaluation.participant.email || "",
    Rating: evaluation.rating,
    "Subject Instructor":
      evaluation.subjectInstructor?.fullNameEn ||
      evaluation.subjectInstructor?.fullNameAr ||
      "",
    "Evaluator Instructor":
      evaluation.evaluatorInstructor?.fullNameEn ||
      evaluation.evaluatorInstructor?.fullNameAr ||
      "",
    Comments: evaluation.comments || "",
    "Updated At": formatDate(evaluation.updatedAt),
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 20 },
    { wch: 28 },
    { wch: 30 },
    { wch: 10 },
    { wch: 28 },
    { wch: 28 },
    { wch: 42 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Evaluations");

  const body = new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${training.runCode}-evaluations.xlsx`)}`,
      "Cache-Control": "no-store",
    },
  });
}
