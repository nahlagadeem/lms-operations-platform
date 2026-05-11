"use server";

import {
  AttendanceStatus,
  NominationStatus,
  ParticipantType,
  CourseRunStatus,
  DeliveryMode,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalInt(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

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
  while (existingCodes.has(`${baseCode}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseCode}-${suffix}`;
}

export async function createCourseRun(formData: FormData) {
  const courseId = normalizeText(formData.get("courseId"));
  const deliveryMode = normalizeText(formData.get("deliveryMode")) as DeliveryMode;
  const status = normalizeText(formData.get("status")) as CourseRunStatus;
  const startDate = parseOptionalDate(normalizeText(formData.get("startDate")));
  const endDate = parseOptionalDate(normalizeText(formData.get("endDate")));
  const plannedSeats = parseOptionalInt(normalizeText(formData.get("plannedSeats")));
  const notes = normalizeText(formData.get("notes"));

  if (!courseId || !deliveryMode || !status) {
    throw new Error("Missing required course run fields.");
  }

  const course = await db.course.findUnique({
    where: {
      id: courseId,
    },
    select: {
      courseCode: true,
      requiresCertificate: true,
    },
  });

  if (!course) {
    throw new Error("Selected course was not found.");
  }

  const runCode = await generateRunCode(course.courseCode, startDate);

  const createdRun = await db.courseRun.create({
    data: {
      courseId,
      runCode,
      deliveryMode,
      status,
      startDate,
      endDate,
      plannedSeats,
      notes: notes || null,
      certificateRequired: course.requiresCertificate,
    },
  });

  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/course-runs");
  redirect(`/course-runs/${createdRun.id}`);
}

export async function updateCourseRun(formData: FormData) {
  const courseRunId = normalizeText(formData.get("courseRunId"));
  const providerId = normalizeText(formData.get("providerId"));
  const locationId = normalizeText(formData.get("locationId"));
  const deliveryMode = normalizeText(formData.get("deliveryMode")) as DeliveryMode;
  const status = normalizeText(formData.get("status")) as CourseRunStatus;
  const startDate = parseOptionalDate(normalizeText(formData.get("startDate")));
  const endDate = parseOptionalDate(normalizeText(formData.get("endDate")));
  const plannedSeats = parseOptionalInt(normalizeText(formData.get("plannedSeats")));
  const notes = normalizeText(formData.get("notes"));

  if (!courseRunId || !deliveryMode || !status) {
    throw new Error("Missing required course run update fields.");
  }

  await db.courseRun.update({
    where: {
      id: courseRunId,
    },
    data: {
      providerId: providerId || null,
      locationId: locationId || null,
      deliveryMode,
      status,
      startDate,
      endDate,
      plannedSeats,
      notes: notes || null,
    },
  });

  revalidatePath("/course-runs");
  revalidatePath(`/course-runs/${courseRunId}`);
  redirect(`/course-runs/${courseRunId}`);
}

export async function assignTrainerToCourseRun(formData: FormData) {
  const courseRunId = normalizeText(formData.get("courseRunId"));
  const trainerId = normalizeText(formData.get("trainerId"));
  const role = normalizeText(formData.get("role"));
  const isPrimary = normalizeText(formData.get("isPrimary")) === "true";

  if (!courseRunId || !trainerId) {
    throw new Error("Missing trainer assignment fields.");
  }

  if (isPrimary) {
    await db.courseRunTrainer.updateMany({
      where: {
        courseRunId,
      },
      data: {
        isPrimary: false,
      },
    });
  }

  await db.courseRunTrainer.upsert({
    where: {
      courseRunId_trainerId: {
        courseRunId,
        trainerId,
      },
    },
    update: {
      role: role || null,
      isPrimary,
    },
    create: {
      courseRunId,
      trainerId,
      role: role || null,
      isPrimary,
    },
  });

  revalidatePath("/course-runs");
  revalidatePath(`/course-runs/${courseRunId}`);
  redirect(`/course-runs/${courseRunId}`);
}

export async function removeTrainerFromCourseRun(formData: FormData) {
  const courseRunId = normalizeText(formData.get("courseRunId"));
  const trainerId = normalizeText(formData.get("trainerId"));

  if (!courseRunId || !trainerId) {
    throw new Error("Missing trainer removal fields.");
  }

  await db.courseRunTrainer.delete({
    where: {
      courseRunId_trainerId: {
        courseRunId,
        trainerId,
      },
    },
  });

  revalidatePath("/course-runs");
  revalidatePath(`/course-runs/${courseRunId}`);
  redirect(`/course-runs/${courseRunId}`);
}

export async function nominateExistingParticipant(formData: FormData) {
  const courseRunId = normalizeText(formData.get("courseRunId"));
  const participantId = normalizeText(formData.get("participantId"));
  const nominationStatus = normalizeText(
    formData.get("nominationStatus"),
  ) as NominationStatus;
  const notes = normalizeText(formData.get("notes"));

  if (!courseRunId || !participantId || !nominationStatus) {
    throw new Error("Missing nomination fields.");
  }

  await db.nomination.upsert({
    where: {
      courseRunId_participantId: {
        courseRunId,
        participantId,
      },
    },
    update: {
      nominationStatus,
      confirmationStatus:
        nominationStatus === NominationStatus.CONFIRMED ? nominationStatus : null,
      confirmedAt:
        nominationStatus === NominationStatus.CONFIRMED ? new Date() : null,
      notes: notes || null,
    },
    create: {
      courseRunId,
      participantId,
      nominationStatus,
      confirmationStatus:
        nominationStatus === NominationStatus.CONFIRMED ? nominationStatus : null,
      confirmedAt:
        nominationStatus === NominationStatus.CONFIRMED ? new Date() : null,
      notes: notes || null,
    },
  });

  await syncConfirmedSeats(courseRunId);
  revalidatePath("/course-runs");
  revalidatePath(`/course-runs/${courseRunId}`);
  redirect(`/course-runs/${courseRunId}`);
}

export async function createParticipantAndNominate(formData: FormData) {
  const courseRunId = normalizeText(formData.get("courseRunId"));
  const participantType = normalizeText(
    formData.get("participantType"),
  ) as ParticipantType;
  const fullNameAr = normalizeText(formData.get("fullNameAr"));
  const fullNameEn = normalizeText(formData.get("fullNameEn"));
  const email = normalizeText(formData.get("email"));
  const phone = normalizeText(formData.get("phone"));
  const organizationName = normalizeText(formData.get("organizationName"));
  const jobTitle = normalizeText(formData.get("jobTitle"));
  const nationalIdOrIqama = normalizeText(formData.get("nationalIdOrIqama"));
  const nominationStatus = normalizeText(
    formData.get("nominationStatus"),
  ) as NominationStatus;
  const notes = normalizeText(formData.get("notes"));

  if (!courseRunId || !participantType || !fullNameAr || !nominationStatus) {
    throw new Error("Missing participant nomination fields.");
  }

  let participant = null;

  if (nationalIdOrIqama) {
    participant = await db.participant.findFirst({
      where: {
        participantType,
        nationalIdOrIqama,
      },
    });
  }

  if (!participant) {
    participant = await db.participant.create({
      data: {
        participantType,
        nationalIdOrIqama: nationalIdOrIqama || null,
        fullNameAr,
        fullNameEn: fullNameEn || null,
        email: email || null,
        phone: phone || null,
        organizationName: organizationName || null,
        jobTitle: jobTitle || null,
      },
    });
  }

  await db.nomination.upsert({
    where: {
      courseRunId_participantId: {
        courseRunId,
        participantId: participant.id,
      },
    },
    update: {
      nominationStatus,
      confirmationStatus:
        nominationStatus === NominationStatus.CONFIRMED ? nominationStatus : null,
      confirmedAt:
        nominationStatus === NominationStatus.CONFIRMED ? new Date() : null,
      notes: notes || null,
    },
    create: {
      courseRunId,
      participantId: participant.id,
      nominationStatus,
      confirmationStatus:
        nominationStatus === NominationStatus.CONFIRMED ? nominationStatus : null,
      confirmedAt:
        nominationStatus === NominationStatus.CONFIRMED ? new Date() : null,
      notes: notes || null,
    },
  });

  await syncConfirmedSeats(courseRunId);
  revalidatePath("/course-runs");
  revalidatePath(`/course-runs/${courseRunId}`);
  redirect(`/course-runs/${courseRunId}`);
}

export async function updateNominationStatus(formData: FormData) {
  const nominationId = normalizeText(formData.get("nominationId"));
  const courseRunId = normalizeText(formData.get("courseRunId"));
  const nominationStatus = normalizeText(
    formData.get("nominationStatus"),
  ) as NominationStatus;

  if (!nominationId || !courseRunId || !nominationStatus) {
    throw new Error("Missing nomination status update fields.");
  }

  await db.nomination.update({
    where: {
      id: nominationId,
    },
    data: {
      nominationStatus,
      confirmationStatus:
        nominationStatus === NominationStatus.CONFIRMED ? nominationStatus : null,
      confirmedAt:
        nominationStatus === NominationStatus.CONFIRMED ? new Date() : null,
      declineReason:
        nominationStatus === NominationStatus.DECLINED ? "Declined by operations" : null,
    },
  });

  await syncConfirmedSeats(courseRunId);
  revalidatePath("/course-runs");
  revalidatePath(`/course-runs/${courseRunId}`);
  redirect(`/course-runs/${courseRunId}`);
}

export async function recordAttendance(formData: FormData) {
  const courseRunId = normalizeText(formData.get("courseRunId"));
  const participantId = normalizeText(formData.get("participantId"));
  const attendanceDateValue = normalizeText(formData.get("attendanceDate"));
  const attendanceStatus = normalizeText(
    formData.get("attendanceStatus"),
  ) as AttendanceStatus;
  const notes = normalizeText(formData.get("notes"));

  if (!courseRunId || !participantId || !attendanceDateValue || !attendanceStatus) {
    throw new Error("Missing attendance fields.");
  }

  const attendanceDate = parseOptionalDate(attendanceDateValue);

  if (!attendanceDate) {
    throw new Error("Attendance date is invalid.");
  }

  await db.attendanceRecord.upsert({
    where: {
      courseRunId_participantId_attendanceDate: {
        courseRunId,
        participantId,
        attendanceDate,
      },
    },
    update: {
      attendanceStatus,
      notes: notes || null,
      recordedAt: new Date(),
    },
    create: {
      courseRunId,
      participantId,
      attendanceDate,
      attendanceStatus,
      notes: notes || null,
    },
  });

  revalidatePath("/course-runs");
  revalidatePath(`/course-runs/${courseRunId}`);
  redirect(`/course-runs/${courseRunId}`);
}
