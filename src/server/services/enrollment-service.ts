import { NominationStatus } from "@prisma/client";
import { db } from "@/lib/db";

type EnrollmentBucket = "pending" | "confirmed" | "cancelled" | "completed";

export type EnrollmentCountsByStatus = {
  totalEnrollments: number;
  pendingEnrollments: number;
  confirmedEnrollments: number;
  cancelledEnrollments: number;
  completedEnrollments: number;
};

export type TrainingEnrollmentSummary = EnrollmentCountsByStatus & {
  completionRate: number;
};

function getEnrollmentBucket(status: NominationStatus): EnrollmentBucket {
  switch (status) {
    case NominationStatus.CONFIRMED:
      return "confirmed";
    case NominationStatus.WITHDRAWN:
      return "completed";
    case NominationStatus.DECLINED:
    case NominationStatus.REPLACED:
      return "cancelled";
    case NominationStatus.NOMINATED:
    case NominationStatus.CONTACTED:
    default:
      return "pending";
  }
}

async function loadEnrollmentStatuses(trainingId: string) {
  return db.nomination.findMany({
    where: {
      courseRunId: trainingId,
    },
    select: {
      nominationStatus: true,
    },
  });
}

export async function getEnrollmentCountsByStatus(
  trainingId: string,
): Promise<EnrollmentCountsByStatus> {
  const nominations = await loadEnrollmentStatuses(trainingId);

  return nominations.reduce<EnrollmentCountsByStatus>(
    (accumulator, nomination) => {
      accumulator.totalEnrollments += 1;

      const bucket = getEnrollmentBucket(nomination.nominationStatus);
      if (bucket === "pending") accumulator.pendingEnrollments += 1;
      if (bucket === "confirmed") accumulator.confirmedEnrollments += 1;
      if (bucket === "cancelled") accumulator.cancelledEnrollments += 1;
      if (bucket === "completed") accumulator.completedEnrollments += 1;

      return accumulator;
    },
    {
      totalEnrollments: 0,
      pendingEnrollments: 0,
      confirmedEnrollments: 0,
      cancelledEnrollments: 0,
      completedEnrollments: 0,
    },
  );
}

export async function getTrainingEnrollmentSummary(
  trainingId: string,
): Promise<TrainingEnrollmentSummary> {
  const counts = await getEnrollmentCountsByStatus(trainingId);
  const completionRate =
    counts.totalEnrollments > 0
      ? (counts.completedEnrollments / counts.totalEnrollments) * 100
      : 0;

  return {
    ...counts,
    completionRate,
  };
}

export async function getCompletionRate(trainingId: string): Promise<number> {
  const summary = await getTrainingEnrollmentSummary(trainingId);
  return summary.completionRate;
}
