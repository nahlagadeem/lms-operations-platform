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
import * as courseRunService from "@/server/services/course-run-service";

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

export async function createCourseRun(formData: FormData) {
  const courseId = normalizeText(formData.get("courseId"));
  const deliveryMode = normalizeText(formData.get("deliveryMode")) as DeliveryMode;
  const status = normalizeText(formData.get("status")) as CourseRunStatus;
  const startDate = parseOptionalDate(normalizeText(formData.get("startDate")));
  const endDate = parseOptionalDate(normalizeText(formData.get("endDate")));
  const plannedSeats = parseOptionalInt(normalizeText(formData.get("plannedSeats")));
  const notes = normalizeText(formData.get("notes"));

  if (!courseId || !deliveryMode || !status) {
    throw new Error("Please choose a course and try again.");
  }

  const createdRun = await courseRunService.createCourseRun({
    courseId,
    deliveryMode,
    status,
    startDate,
    endDate,
    plannedSeats,
    notes,
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
    throw new Error("Please complete the required course details.");
  }

  await courseRunService.updateCourseRun({
    courseRunId,
    providerId,
    locationId,
    deliveryMode,
    status,
    startDate,
    endDate,
    plannedSeats,
    notes,
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

  await courseRunService.assignTrainerToCourseRun({
    courseRunId,
    trainerId,
    role,
    isPrimary,
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

  await courseRunService.removeTrainerFromCourseRun(courseRunId, trainerId);

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

  await courseRunService.nominateExistingParticipant({
    courseRunId,
    participantId,
    nominationStatus,
    notes,
  });

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

  await courseRunService.createParticipantAndNominate({
    courseRunId,
    participantType,
    fullNameAr,
    fullNameEn,
    email,
    phone,
    organizationName,
    jobTitle,
    nationalIdOrIqama,
    nominationStatus,
    notes,
  });

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

  await courseRunService.updateNominationStatus({
    nominationId,
    courseRunId,
    nominationStatus,
  });

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

  await courseRunService.recordAttendance({
    courseRunId,
    participantId,
    attendanceDate,
    attendanceStatus,
    notes,
  });

  revalidatePath("/course-runs");
  revalidatePath(`/course-runs/${courseRunId}`);
  redirect(`/course-runs/${courseRunId}`);
}
