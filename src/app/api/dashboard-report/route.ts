import { NextRequest, NextResponse } from "next/server";
import {
  ApprovalStatus,
  CourseRunStatus,
  Prisma,
  ReportStatus,
} from "@prisma/client";
import { db } from "@/lib/db";

const pendingApprovalDays = 3;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalize(value: string | null) {
  return value?.trim() || "";
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function formatDate(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const q = normalize(search.get("q"));
  const status = normalize(search.get("status")) as CourseRunStatus | "";
  const scope = normalize(search.get("scope"));
  const alert = normalize(search.get("alert"));
  const todayStart = startOfDay(new Date());
  const pendingApprovalCutoff = addDays(todayStart, -pendingApprovalDays);

  const where: Prisma.CourseRunWhereInput = {
    status: status || undefined,
    course: scope
      ? {
          scopeSelections: {
            some: {
              scope: {
                code: scope,
              },
            },
          },
        }
      : undefined,
    OR: q
      ? [
          { runCode: { contains: q, mode: "insensitive" } },
          { course: { courseCode: { contains: q, mode: "insensitive" } } },
          { course: { nameAr: { contains: q, mode: "insensitive" } } },
          { course: { nameEn: { contains: q, mode: "insensitive" } } },
          { provider: { nameAr: { contains: q, mode: "insensitive" } } },
          { provider: { nameEn: { contains: q, mode: "insensitive" } } },
        ]
      : undefined,
  };

  if (alert === "overdue-reports") {
    where.qualityReports = {
      some: {
        reportStatus: { notIn: [ReportStatus.SUBMITTED, ReportStatus.APPROVED] },
        dueDate: { lt: todayStart },
      },
    };
  }

  if (alert === "pending-approvals") {
    where.approvalStatus = ApprovalStatus.PENDING;
    where.updatedAt = { lt: pendingApprovalCutoff };
  }

  const rows = await db.courseRun.findMany({
    where,
    include: {
      course: {
        include: {
          package: { select: { code: true, nameAr: true, nameEn: true } },
          scopeSelections: {
            include: { scope: { select: { code: true, name: true } } },
          },
        },
      },
      provider: { select: { nameAr: true, nameEn: true } },
      location: { select: { nameAr: true, nameEn: true, city: true } },
      qualityReports: {
        select: { reportStatus: true, dueDate: true, satisfactionRate: true },
        orderBy: { dueDate: "desc" },
        take: 1,
      },
      _count: {
        select: { nominations: true, attendanceRecords: true, evaluations: true },
      },
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    take: 5000,
  });

  const header = [
    "Course Session",
    "Course code",
    "Course",
    "Package",
    "Project Scopes",
    "Status",
    "Start date",
    "End date",
    "Training Provider",
    "Location",
    "Confirmed seats",
    "Planned seats",
    "Nominations",
    "Attendance entries",
    "Feedback entries",
    "Report status",
    "Report due date",
    "Satisfaction rate",
  ];

  const csvRows = rows.map((run) => {
    const qualityReport = run.qualityReports[0];
    return [
      run.runCode,
      run.course.courseCode,
      run.course.nameEn || run.course.nameAr,
      run.course.package.nameEn || run.course.package.nameAr,
      run.course.scopeSelections.map((selection) => selection.scope.code).join(", "),
      run.status,
      formatDate(run.startDate),
      formatDate(run.endDate),
      run.provider?.nameEn || run.provider?.nameAr || "",
      run.location?.nameEn || run.location?.nameAr || run.location?.city || "",
      run.confirmedSeats,
      run.plannedSeats ?? 0,
      run._count.nominations,
      run._count.attendanceRecords,
      run._count.evaluations,
      qualityReport?.reportStatus || "",
      formatDate(qualityReport?.dueDate ?? null),
      qualityReport?.satisfactionRate ? Number(qualityReport.satisfactionRate) : "",
    ].map(csvCell).join(",");
  });

  const csv = [header.map(csvCell).join(","), ...csvRows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dashboard-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
