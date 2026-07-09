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

function numericCodeToken(value: string, minLength: number) {
  const match = value.match(/(\d+)(?!.*\d)/);
  if (!match) return value.toUpperCase().replace(/[^A-Z0-9]+/g, "");

  return String(Number(match[1])).padStart(minLength, "0");
}

async function generateRunCode(packageCode: string, courseCode: string) {
  const baseCode = `PKG${numericCodeToken(packageCode, 2)}-CRS${numericCodeToken(courseCode, 3)}`;
  const trainingCodePattern = new RegExp(`^${baseCode}-TRN(\\d+)$`);
  const existing = await db.courseRun.findMany({
    where: {
      runCode: {
        startsWith: `${baseCode}-TRN`,
      },
    },
    select: {
      runCode: true,
    },
  });
  const nextNumber =
    existing.reduce((max, item) => {
      const match = item.runCode.match(trainingCodePattern);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;

  return `${baseCode}-TRN${String(nextNumber).padStart(3, "0")}`;
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
      package: { select: { code: true } },
    },
  });

  if (!course) {
    throw new Error("Selected course was not found.");
  }

  const runCode = await generateRunCode(course.package.code, course.courseCode);

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
