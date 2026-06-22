import { Prisma, TrainingEvaluationType } from "@prisma/client";
import { db } from "@/lib/db";

type BaseEvaluationInput = {
  courseRunId: string;
  participantId: string;
  rating: number;
  comments?: string | null;
};

type InstructorEvaluationInput = BaseEvaluationInput & {
  subjectInstructorId: string;
};

type AttendeeEvaluationInput = BaseEvaluationInput & {
  evaluatorInstructorId: string;
};

type EvaluationSummary = {
  totalEvaluations: number;
  courseEvaluationCount: number;
  instructorEvaluationCount: number;
  attendeeEvaluationCount: number;
  averageCourseRating: number | null;
  averageInstructorRating: number | null;
  averageAttendeeRating: number | null;
};

function normalizeComments(value?: string | null) {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertRating(rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be an integer between 1 and 5.");
  }
}

async function assertTrainingExists(courseRunId: string) {
  const training = await db.courseRun.findUnique({
    where: { id: courseRunId },
    select: { id: true },
  });

  if (!training) {
    throw new Error("Training was not found.");
  }
}

async function assertEnrolledParticipant(courseRunId: string, participantId: string) {
  const enrollment = await db.nomination.findFirst({
    where: {
      courseRunId,
      participantId,
    },
    select: { id: true },
  });

  if (!enrollment) {
    throw new Error("Selected attendee is not enrolled in this training.");
  }
}

async function assertAssignedInstructor(courseRunId: string, trainerId: string) {
  const assignment = await db.courseRunTrainer.findFirst({
    where: {
      courseRunId,
      trainerId,
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new Error("Selected instructor is not assigned to this training.");
  }
}

async function upsertEvaluation(
  where: Prisma.TrainingEvaluationWhereInput,
  data: Prisma.TrainingEvaluationUncheckedCreateInput,
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.trainingEvaluation.findFirst({
      where,
      select: { id: true },
    });

    if (existing) {
      return tx.trainingEvaluation.update({
        where: { id: existing.id },
        data,
      });
    }

    return tx.trainingEvaluation.create({
      data,
    });
  });
}

async function getAverageRating(courseRunId: string, evaluationType: TrainingEvaluationType) {
  const aggregate = await db.trainingEvaluation.aggregate({
    where: { courseRunId, evaluationType },
    _avg: { rating: true },
  });

  return aggregate._avg.rating ?? null;
}

export async function upsertCourseEvaluation(input: BaseEvaluationInput) {
  assertRating(input.rating);
  await assertTrainingExists(input.courseRunId);
  await assertEnrolledParticipant(input.courseRunId, input.participantId);

  const comments = normalizeComments(input.comments);

  return upsertEvaluation(
    {
      courseRunId: input.courseRunId,
      participantId: input.participantId,
      evaluationType: TrainingEvaluationType.COURSE,
    },
    {
      courseRunId: input.courseRunId,
      participantId: input.participantId,
      evaluationType: TrainingEvaluationType.COURSE,
      rating: input.rating,
      comments,
    },
  );
}

export async function upsertInstructorEvaluation(input: InstructorEvaluationInput) {
  assertRating(input.rating);
  await assertTrainingExists(input.courseRunId);
  await assertEnrolledParticipant(input.courseRunId, input.participantId);
  await assertAssignedInstructor(input.courseRunId, input.subjectInstructorId);

  const comments = normalizeComments(input.comments);

  return upsertEvaluation(
    {
      courseRunId: input.courseRunId,
      participantId: input.participantId,
      evaluationType: TrainingEvaluationType.INSTRUCTOR,
      subjectInstructorId: input.subjectInstructorId,
    },
    {
      courseRunId: input.courseRunId,
      participantId: input.participantId,
      evaluationType: TrainingEvaluationType.INSTRUCTOR,
      rating: input.rating,
      comments,
      subjectInstructorId: input.subjectInstructorId,
    },
  );
}

export async function upsertAttendeeEvaluation(input: AttendeeEvaluationInput) {
  assertRating(input.rating);
  await assertTrainingExists(input.courseRunId);
  await assertEnrolledParticipant(input.courseRunId, input.participantId);
  await assertAssignedInstructor(input.courseRunId, input.evaluatorInstructorId);

  const comments = normalizeComments(input.comments);

  return upsertEvaluation(
    {
      courseRunId: input.courseRunId,
      participantId: input.participantId,
      evaluationType: TrainingEvaluationType.ATTENDEE,
      evaluatorInstructorId: input.evaluatorInstructorId,
    },
    {
      courseRunId: input.courseRunId,
      participantId: input.participantId,
      evaluationType: TrainingEvaluationType.ATTENDEE,
      rating: input.rating,
      comments,
      evaluatorInstructorId: input.evaluatorInstructorId,
    },
  );
}

export async function getAverageCourseRating(courseRunId: string) {
  return getAverageRating(courseRunId, TrainingEvaluationType.COURSE);
}

export async function getAverageInstructorRating(courseRunId: string) {
  return getAverageRating(courseRunId, TrainingEvaluationType.INSTRUCTOR);
}

export async function getProjectQualityOverview(): Promise<EvaluationSummary> {
  const [courseSummary, instructorSummary, attendeeSummary] = await Promise.all([
    db.trainingEvaluation.aggregate({
      where: { evaluationType: TrainingEvaluationType.COURSE },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    db.trainingEvaluation.aggregate({
      where: { evaluationType: TrainingEvaluationType.INSTRUCTOR },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    db.trainingEvaluation.aggregate({
      where: { evaluationType: TrainingEvaluationType.ATTENDEE },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  const totalEvaluations =
    courseSummary._count._all + instructorSummary._count._all + attendeeSummary._count._all;

  return {
    totalEvaluations,
    courseEvaluationCount: courseSummary._count._all,
    instructorEvaluationCount: instructorSummary._count._all,
    attendeeEvaluationCount: attendeeSummary._count._all,
    averageCourseRating: courseSummary._avg.rating ?? null,
    averageInstructorRating: instructorSummary._avg.rating ?? null,
    averageAttendeeRating: attendeeSummary._avg.rating ?? null,
  };
}
