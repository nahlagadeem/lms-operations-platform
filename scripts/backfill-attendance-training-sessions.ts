import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

function normalizeSessionDate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function main() {
  const attendanceRecords = await db.attendanceRecord.findMany({
    where: {
      trainingSessionId: null,
    },
    select: {
      id: true,
      courseRunId: true,
      participantId: true,
      attendanceDate: true,
    },
    orderBy: [{ courseRunId: "asc" }, { attendanceDate: "asc" }, { participantId: "asc" }],
  });

  let linkedCount = 0;
  let unmatchedCount = 0;
  let conflictCount = 0;

  for (const record of attendanceRecords) {
    const sessionDate = normalizeSessionDate(record.attendanceDate);
    const session = await db.trainingSession.findUnique({
      where: {
        courseRunId_sessionDate: {
          courseRunId: record.courseRunId,
          sessionDate,
        },
      },
      select: {
        id: true,
      },
    });

    if (!session) {
      unmatchedCount += 1;
      continue;
    }

    try {
      await db.attendanceRecord.update({
        where: {
          id: record.id,
        },
        data: {
          trainingSessionId: session.id,
        },
      });
      linkedCount += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        conflictCount += 1;
        continue;
      }

      throw error;
    }
  }

  console.log("Attendance TrainingSession backfill complete.");
  console.log({
    totalScanned: attendanceRecords.length,
    linkedCount,
    unmatchedCount,
    conflictCount,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
