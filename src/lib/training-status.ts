import { CourseRunStatus } from "@prisma/client";

export type TrainingDisplayStatus =
  | "PLANNED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELED";

export type TrainingState = "ACTIVE" | "CANCELED";

export const simplifiedTrainingStatuses = [
  CourseRunStatus.PLANNED,
  CourseRunStatus.CONFIRMED,
  CourseRunStatus.COMPLETED,
  CourseRunStatus.CANCELED,
] as const;

export function deriveTrainingDisplayStatus(training: {
  status: CourseRunStatus;
  plannedSeats: number | null;
  confirmedSeats: number;
  trainingEvaluationCount?: number;
  trainingEvaluations?: unknown[];
}): TrainingDisplayStatus {
  if (training.status === CourseRunStatus.CANCELED) {
    return CourseRunStatus.CANCELED;
  }

  const evaluationCount =
    training.trainingEvaluationCount ?? training.trainingEvaluations?.length ?? 0;

  if (evaluationCount > 0) {
    return CourseRunStatus.COMPLETED;
  }

  if (training.confirmedSeats > 0) {
    return CourseRunStatus.CONFIRMED;
  }

  return CourseRunStatus.PLANNED;
}

export function trainingStateFromStatus(status: CourseRunStatus): TrainingState {
  return status === CourseRunStatus.CANCELED ? "CANCELED" : "ACTIVE";
}

export function derivePersistedTrainingStatus(input: {
  trainingState: TrainingState;
  plannedSeats: number | null;
  confirmedSeats: number;
  trainingEvaluationCount?: number;
}) {
  return deriveTrainingDisplayStatus({
    status:
      input.trainingState === "CANCELED"
        ? CourseRunStatus.CANCELED
        : CourseRunStatus.PLANNED,
    plannedSeats: input.plannedSeats,
    confirmedSeats: input.confirmedSeats,
    trainingEvaluationCount: input.trainingEvaluationCount,
  });
}
