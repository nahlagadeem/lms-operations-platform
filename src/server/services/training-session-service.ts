import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type CreateTrainingSessionInput = {
  courseRunId: string;
  sessionDate: Date;
  notes: string;
};

type UpdateTrainingSessionInput = {
  sessionId: string;
  courseRunId: string;
  sessionDate: Date;
  notes: string;
};

function normalizeSessionDate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function assertCourseRunExists(courseRunId: string) {
  const courseRun = await db.courseRun.findUnique({
    where: { id: courseRunId },
    select: { id: true },
  });

  if (!courseRun) {
    throw new Error("Training was not found.");
  }
}

function handleUniqueSessionError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new Error("A session already exists for this training date.");
  }

  throw error;
}

export async function createTrainingSession(input: CreateTrainingSessionInput) {
  await assertCourseRunExists(input.courseRunId);

  try {
    return await db.trainingSession.create({
      data: {
        courseRunId: input.courseRunId,
        sessionDate: normalizeSessionDate(input.sessionDate),
        notes: input.notes || null,
      },
    });
  } catch (error) {
    handleUniqueSessionError(error);
  }
}

export async function updateTrainingSession(input: UpdateTrainingSessionInput) {
  await assertCourseRunExists(input.courseRunId);

  const session = await db.trainingSession.findFirst({
    where: {
      id: input.sessionId,
      courseRunId: input.courseRunId,
    },
    select: { id: true },
  });

  if (!session) {
    throw new Error("Training session was not found.");
  }

  try {
    return await db.trainingSession.update({
      where: { id: input.sessionId },
      data: {
        sessionDate: normalizeSessionDate(input.sessionDate),
        notes: input.notes || null,
      },
    });
  } catch (error) {
    handleUniqueSessionError(error);
  }
}
