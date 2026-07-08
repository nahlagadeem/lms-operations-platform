import "server-only";

import { AttendanceStatus, NominationStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type TrainingCapacityInput = {
  plannedSeats: number | null;
  confirmedSeats: number;
};

export type TrainingCapacity = {
  estimatedSeats: number;
  actualSeats: number;
  utilizationPct: number;
  remainingCapacity: number;
  fullyBooked: boolean;
  overCapacityBy: number;
};

export type AttendanceRateResult = {
  attended: number;
  enrolled: number;
  attendanceRate: number;
};

export type SessionAttendanceRateResult = {
  attendedSessions: number;
  possibleSessions: number;
  attendanceRate: number;
  trainingCount: number;
  eligibleEnrollmentCount: number;
  sessionCount: number;
};

const eligibleAttendanceEnrollmentStatuses: NominationStatus[] = [
  NominationStatus.NOMINATED,
  NominationStatus.CONTACTED,
  NominationStatus.CONFIRMED,
];

const courseRunSessionAttendanceSelect = {
  id: true,
  sessions: {
    select: {
      id: true,
      sessionDate: true,
    },
    orderBy: {
      sessionDate: "asc",
    },
  },
  nominations: {
    select: {
      participantId: true,
      nominationStatus: true,
    },
  },
  attendanceRecords: {
    select: {
      participantId: true,
      trainingSessionId: true,
      attendanceDate: true,
      attendanceStatus: true,
      recordedAt: true,
    },
    orderBy: {
      recordedAt: "desc",
    },
  },
} satisfies Prisma.CourseRunSelect;

type CourseRunSessionAttendance = Prisma.CourseRunGetPayload<{
  select: typeof courseRunSessionAttendanceSelect;
}>;

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function attendanceCellKey(participantId: string, sessionId: string) {
  return `${participantId}:${sessionId}`;
}

function calculateSessionAttendanceRate(
  courseRuns: CourseRunSessionAttendance[],
): SessionAttendanceRateResult {
  let attendedSessions = 0;
  let possibleSessions = 0;
  let eligibleEnrollmentCount = 0;
  let sessionCount = 0;

  for (const courseRun of courseRuns) {
    const sessionIds = new Set(courseRun.sessions.map((session) => session.id));
    const sessionIdByDate = new Map(
      courseRun.sessions.map((session) => [dateKey(session.sessionDate), session.id]),
    );
    const eligibleParticipantIds = new Set(
      courseRun.nominations
        .filter((nomination) =>
          eligibleAttendanceEnrollmentStatuses.includes(nomination.nominationStatus),
        )
        .map((nomination) => nomination.participantId),
    );
    const attendanceByCell = new Map<string, AttendanceStatus>();

    eligibleEnrollmentCount += eligibleParticipantIds.size;
    sessionCount += sessionIds.size;
    possibleSessions += eligibleParticipantIds.size * sessionIds.size;

    for (const record of courseRun.attendanceRecords) {
      if (!record.trainingSessionId) {
        continue;
      }

      if (
        !sessionIds.has(record.trainingSessionId) ||
        !eligibleParticipantIds.has(record.participantId)
      ) {
        continue;
      }

      const cellKey = attendanceCellKey(record.participantId, record.trainingSessionId);
      if (!attendanceByCell.has(cellKey)) {
        attendanceByCell.set(cellKey, record.attendanceStatus);
      }
    }

    for (const record of courseRun.attendanceRecords) {
      if (record.trainingSessionId || !eligibleParticipantIds.has(record.participantId)) {
        continue;
      }

      const sessionId = sessionIdByDate.get(dateKey(record.attendanceDate));
      if (!sessionId) {
        continue;
      }

      const cellKey = attendanceCellKey(record.participantId, sessionId);
      if (!attendanceByCell.has(cellKey)) {
        attendanceByCell.set(cellKey, record.attendanceStatus);
      }
    }

    for (const attendanceStatus of attendanceByCell.values()) {
      if (attendanceStatus === AttendanceStatus.PRESENT) {
        attendedSessions += 1;
      }
    }
  }

  return {
    attendedSessions,
    possibleSessions,
    attendanceRate: possibleSessions > 0 ? (attendedSessions / possibleSessions) * 100 : 0,
    trainingCount: courseRuns.length,
    eligibleEnrollmentCount,
    sessionCount,
  };
}

async function getSessionAttendanceRateForCourseRuns(
  where: Prisma.CourseRunWhereInput,
): Promise<SessionAttendanceRateResult> {
  const courseRuns = await db.courseRun.findMany({
    where,
    select: courseRunSessionAttendanceSelect,
  });

  return calculateSessionAttendanceRate(courseRuns);
}

export function getTrainingCapacity(input: TrainingCapacityInput): TrainingCapacity {
  const estimatedSeats = input.plannedSeats ?? 0;
  const actualSeats = input.confirmedSeats;

  return {
    estimatedSeats,
    actualSeats,
    utilizationPct: input.plannedSeats ? (input.confirmedSeats / input.plannedSeats) * 100 : 0,
    remainingCapacity: Math.max(0, estimatedSeats - actualSeats),
    fullyBooked: input.plannedSeats !== null && actualSeats >= input.plannedSeats,
    overCapacityBy: input.plannedSeats !== null ? Math.max(0, actualSeats - input.plannedSeats) : 0,
  };
}

export async function getTrainingSessionAttendanceRate(
  courseRunId: string,
): Promise<SessionAttendanceRateResult> {
  return getSessionAttendanceRateForCourseRuns({ id: courseRunId });
}

export async function getCourseSessionAttendanceRate(
  courseId: string,
): Promise<SessionAttendanceRateResult> {
  return getSessionAttendanceRateForCourseRuns({ courseId });
}

export async function getPackageSessionAttendanceRate(
  packageId: string,
): Promise<SessionAttendanceRateResult> {
  return getSessionAttendanceRateForCourseRuns({
    course: {
      packageId,
    },
  });
}

export async function getProjectSessionAttendanceRate(): Promise<SessionAttendanceRateResult> {
  return getSessionAttendanceRateForCourseRuns({});
}

export async function getAttendanceRate(courseRunId: string): Promise<AttendanceRateResult> {
  const [attended, enrolled] = await Promise.all([
    db.attendanceRecord.count({
      where: {
        courseRunId,
        attendanceStatus: {
          in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.PARTIAL],
        },
      },
    }),
    db.nomination.count({
      where: {
        courseRunId,
      },
    }),
  ]);

  return {
    attended,
    enrolled,
    attendanceRate: enrolled > 0 ? (attended / enrolled) * 100 : 0,
  };
}
