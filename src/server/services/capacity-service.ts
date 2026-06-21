import "server-only";

import { AttendanceStatus } from "@prisma/client";
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
