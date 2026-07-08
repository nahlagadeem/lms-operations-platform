import {
  AttendanceStatus,
  CourseRunStatus,
  DeliveryMode,
  NominationStatus,
  ParticipantType,
} from "@prisma/client";
import { db } from "@/lib/db";

type CreateCourseRunInput = {
  courseId: string;
  deliveryMode: DeliveryMode;
  status: CourseRunStatus;
  startDate: Date | null;
  endDate: Date | null;
  plannedSeats: number | null;
  notes: string;
};

type UpdateCourseRunInput = {
  courseRunId: string;
  providerId: string;
  locationId: string;
  deliveryMode: DeliveryMode;
  status: CourseRunStatus;
  startDate: Date | null;
  endDate: Date | null;
  plannedSeats: number | null;
  notes: string;
};

type TrainerAssignmentInput = {
  courseRunId: string;
  trainerId: string;
  role: string;
  isPrimary: boolean;
};

type NominateExistingParticipantInput = {
  courseRunId: string;
  participantId: string;
  nominationStatus: NominationStatus;
  notes: string;
};

type CreateParticipantAndNominateInput = {
  courseRunId: string;
  participantType: ParticipantType;
  fullNameAr: string;
  fullNameEn: string;
  email: string;
  phone: string;
  organizationName: string;
  jobTitle: string;
  nationalIdOrIqama: string;
  nominationStatus: NominationStatus;
  notes: string;
};

type UpdateNominationStatusInput = {
  nominationId: string;
  courseRunId: string;
  nominationStatus: NominationStatus;
  notes?: string;
};

type RecordAttendanceInput = {
  courseRunId?: string;
  trainingSessionId?: string;
  participantId: string;
  attendanceDate?: Date;
  attendanceStatus: AttendanceStatus;
  notes: string;
};

async function syncConfirmedSeats(courseRunId: string) {
  const confirmedSeats = await db.nomination.count({
    where: {
      courseRunId,
      nominationStatus: NominationStatus.CONFIRMED,
    },
  });

  await db.courseRun.update({
    where: {
      id: courseRunId,
    },
    data: {
      confirmedSeats,
    },
  });
}

async function generateRunCode(courseCode: string, startDate: Date | null) {
  const dateToken = startDate
    ? startDate.toISOString().slice(0, 10).replaceAll("-", "")
    : new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const baseCode = `${courseCode}-${dateToken}`;

  const existing = await db.courseRun.findMany({
    where: {
      runCode: {
        startsWith: baseCode,
      },
    },
    select: {
      runCode: true,
    },
  });

  if (existing.length === 0) {
    return baseCode;
  }

  let suffix = 2;
  const existingCodes = new Set(existing.map((item) => item.runCode));
  while (existingCodes.has(`${baseCode}-${String(suffix).padStart(2, "0")}`)) {
    suffix += 1;
  }

  return `${baseCode}-${String(suffix).padStart(2, "0")}`;
}

function nominationConfirmationData(nominationStatus: NominationStatus) {
  return {
    confirmationStatus:
      nominationStatus === NominationStatus.CONFIRMED ? nominationStatus : null,
    confirmedAt:
      nominationStatus === NominationStatus.CONFIRMED ? new Date() : null,
  };
}

export async function createCourseRun(input: CreateCourseRunInput) {
  const course = await db.course.findUnique({
    where: {
      id: input.courseId,
    },
    select: {
      courseCode: true,
      requiresCertificate: true,
    },
  });

  if (!course) {
    throw new Error("Selected course was not found.");
  }

  const runCode = await generateRunCode(course.courseCode, input.startDate);

  return db.courseRun.create({
    data: {
      courseId: input.courseId,
      runCode,
      deliveryMode: input.deliveryMode,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      plannedSeats: input.plannedSeats,
      notes: input.notes || null,
      certificateRequired: course.requiresCertificate,
    },
    select: {
      id: true,
    },
  });
}

export async function updateCourseRun(input: UpdateCourseRunInput) {
  await db.courseRun.update({
    where: {
      id: input.courseRunId,
    },
    data: {
      providerId: input.providerId || null,
      locationId: input.locationId || null,
      deliveryMode: input.deliveryMode,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      plannedSeats: input.plannedSeats,
      notes: input.notes || null,
    },
  });
}

export async function assignTrainerToCourseRun(input: TrainerAssignmentInput) {
  if (input.isPrimary) {
    await db.courseRunTrainer.updateMany({
      where: {
        courseRunId: input.courseRunId,
      },
      data: {
        isPrimary: false,
      },
    });
  }

  await db.courseRunTrainer.upsert({
    where: {
      courseRunId_trainerId: {
        courseRunId: input.courseRunId,
        trainerId: input.trainerId,
      },
    },
    update: {
      role: input.role || null,
      isPrimary: input.isPrimary,
    },
    create: {
      courseRunId: input.courseRunId,
      trainerId: input.trainerId,
      role: input.role || null,
      isPrimary: input.isPrimary,
    },
  });
}

export async function removeTrainerFromCourseRun(courseRunId: string, trainerId: string) {
  await db.courseRunTrainer.delete({
    where: {
      courseRunId_trainerId: {
        courseRunId,
        trainerId,
      },
    },
  });
}

export async function nominateExistingParticipant(input: NominateExistingParticipantInput) {
  const confirmationData = nominationConfirmationData(input.nominationStatus);

  await db.nomination.upsert({
    where: {
      courseRunId_participantId: {
        courseRunId: input.courseRunId,
        participantId: input.participantId,
      },
    },
    update: {
      nominationStatus: input.nominationStatus,
      ...confirmationData,
      notes: input.notes || null,
    },
    create: {
      courseRunId: input.courseRunId,
      participantId: input.participantId,
      nominationStatus: input.nominationStatus,
      ...confirmationData,
      notes: input.notes || null,
    },
  });

  await syncConfirmedSeats(input.courseRunId);
}

export async function createParticipantAndNominate(input: CreateParticipantAndNominateInput) {
  let participant = null;

  if (input.nationalIdOrIqama) {
    participant = await db.participant.findFirst({
      where: {
        participantType: input.participantType,
        nationalIdOrIqama: input.nationalIdOrIqama,
      },
    });
  }

  if (!participant) {
    participant = await db.participant.create({
      data: {
        participantType: input.participantType,
        nationalIdOrIqama: input.nationalIdOrIqama || null,
        fullNameAr: input.fullNameAr,
        fullNameEn: input.fullNameEn || null,
        email: input.email || null,
        phone: input.phone || null,
        organizationName: input.organizationName || null,
        jobTitle: input.jobTitle || null,
      },
    });
  }

  const confirmationData = nominationConfirmationData(input.nominationStatus);

  await db.nomination.upsert({
    where: {
      courseRunId_participantId: {
        courseRunId: input.courseRunId,
        participantId: participant.id,
      },
    },
    update: {
      nominationStatus: input.nominationStatus,
      ...confirmationData,
      notes: input.notes || null,
    },
    create: {
      courseRunId: input.courseRunId,
      participantId: participant.id,
      nominationStatus: input.nominationStatus,
      ...confirmationData,
      notes: input.notes || null,
    },
  });

  await syncConfirmedSeats(input.courseRunId);
}

export async function updateNominationStatus(input: UpdateNominationStatusInput) {
  await db.nomination.update({
    where: {
      id: input.nominationId,
    },
    data: {
      nominationStatus: input.nominationStatus,
      ...nominationConfirmationData(input.nominationStatus),
      notes: input.notes === undefined ? undefined : input.notes || null,
      declineReason:
        input.nominationStatus === NominationStatus.DECLINED
          ? "Declined by operations"
          : null,
    },
  });

  await syncConfirmedSeats(input.courseRunId);
}

export async function recordAttendance(input: RecordAttendanceInput) {
  if (input.trainingSessionId) {
    const session = await db.trainingSession.findUnique({
      where: {
        id: input.trainingSessionId,
      },
      select: {
        id: true,
        courseRunId: true,
        sessionDate: true,
      },
    });

    if (!session) {
      throw new Error("Training session was not found.");
    }

    if (input.courseRunId && input.courseRunId !== session.courseRunId) {
      throw new Error("Training session does not belong to the submitted training.");
    }

    await db.attendanceRecord.upsert({
      where: {
        trainingSessionId_participantId: {
          trainingSessionId: session.id,
          participantId: input.participantId,
        },
      },
      update: {
        courseRunId: session.courseRunId,
        attendanceDate: session.sessionDate,
        attendanceStatus: input.attendanceStatus,
        notes: input.notes || null,
        recordedAt: new Date(),
      },
      create: {
        courseRunId: session.courseRunId,
        trainingSessionId: session.id,
        participantId: input.participantId,
        attendanceDate: session.sessionDate,
        attendanceStatus: input.attendanceStatus,
        notes: input.notes || null,
      },
    });
    return;
  }

  if (!input.courseRunId || !input.attendanceDate) {
    throw new Error("Missing attendance training or date fields.");
  }

  await db.attendanceRecord.upsert({
    where: {
      courseRunId_participantId_attendanceDate: {
        courseRunId: input.courseRunId,
        participantId: input.participantId,
        attendanceDate: input.attendanceDate,
      },
    },
    update: {
      attendanceStatus: input.attendanceStatus,
      notes: input.notes || null,
      recordedAt: new Date(),
    },
    create: {
      courseRunId: input.courseRunId,
      participantId: input.participantId,
      attendanceDate: input.attendanceDate,
      attendanceStatus: input.attendanceStatus,
      notes: input.notes || null,
    },
  });
}
