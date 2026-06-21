"use server";

import {
  AttendanceStatus,
  DeliveryMode,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { AttendeeType, EnrollmentStatus, TrainingStatus } from "@/lib/brd-terminology";
import * as trainingService from "@/server/services/training-service";

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

export async function createTraining(formData: FormData) {
  await requireAuth();

  const courseId = normalizeText(formData.get("courseId"));
  const deliveryMode = normalizeText(formData.get("deliveryMode")) as DeliveryMode;
  const status = normalizeText(formData.get("status")) as TrainingStatus;
  const startDate = parseOptionalDate(normalizeText(formData.get("startDate")));
  const endDate = parseOptionalDate(normalizeText(formData.get("endDate")));
  const plannedSeats = parseOptionalInt(normalizeText(formData.get("estimatedSeats")));
  const notes = normalizeText(formData.get("notes"));

  if (!courseId || !deliveryMode || !status) {
    throw new Error("Please choose a course and try again.");
  }

  const createdRun = await trainingService.createTraining({
    courseId,
    deliveryMode,
    status,
    startDate,
    endDate,
    plannedSeats,
    notes,
  });

  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/trainings");
  redirect(`/trainings/${createdRun.id}`);
}

export async function updateTraining(formData: FormData) {
  await requireAuth();

  const courseRunId = normalizeText(formData.get("trainingId"));
  const providerId = normalizeText(formData.get("vendorId"));
  const locationId = normalizeText(formData.get("locationId"));
  const deliveryMode = normalizeText(formData.get("deliveryMode")) as DeliveryMode;
  const status = normalizeText(formData.get("status")) as TrainingStatus;
  const startDate = parseOptionalDate(normalizeText(formData.get("startDate")));
  const endDate = parseOptionalDate(normalizeText(formData.get("endDate")));
  const plannedSeats = parseOptionalInt(normalizeText(formData.get("estimatedSeats")));
  const notes = normalizeText(formData.get("notes"));

  if (!courseRunId || !deliveryMode || !status) {
    throw new Error("Please complete the required training details.");
  }

  await trainingService.updateTraining({
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

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${courseRunId}`);
  redirect(`/trainings/${courseRunId}`);
}

export async function assignInstructorToTraining(formData: FormData) {
  await requireAuth();

  const courseRunId = normalizeText(formData.get("trainingId"));
  const trainerId = normalizeText(formData.get("instructorId"));
  const role = normalizeText(formData.get("role"));
  const isPrimary = normalizeText(formData.get("isPrimary")) === "true";

  if (!courseRunId || !trainerId) {
    throw new Error("Missing instructor assignment fields.");
  }

  await trainingService.assignInstructorToTraining({
    courseRunId,
    trainerId,
    role,
    isPrimary,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${courseRunId}`);
  redirect(`/trainings/${courseRunId}`);
}

export async function removeInstructorFromTraining(formData: FormData) {
  await requireAuth();

  const courseRunId = normalizeText(formData.get("trainingId"));
  const trainerId = normalizeText(formData.get("instructorId"));

  if (!courseRunId || !trainerId) {
    throw new Error("Missing instructor removal fields.");
  }

  await trainingService.removeInstructorFromTraining(courseRunId, trainerId);

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${courseRunId}`);
  redirect(`/trainings/${courseRunId}`);
}

export async function enrollExistingAttendee(formData: FormData) {
  await requireAuth();

  const courseRunId = normalizeText(formData.get("trainingId"));
  const participantId = normalizeText(formData.get("attendeeId"));
  const nominationStatus = normalizeText(
    formData.get("enrollmentStatus"),
  ) as EnrollmentStatus;
  const notes = normalizeText(formData.get("notes"));

  if (!courseRunId || !participantId || !nominationStatus) {
    throw new Error("Missing enrollment fields.");
  }

  await trainingService.enrollExistingAttendee({
    courseRunId,
    participantId,
    nominationStatus,
    notes,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${courseRunId}`);
  redirect(`/trainings/${courseRunId}`);
}

export async function createAttendeeAndEnroll(formData: FormData) {
  await requireAuth();

  const courseRunId = normalizeText(formData.get("trainingId"));
  const participantType = normalizeText(
    formData.get("attendeeType"),
  ) as AttendeeType;
  const fullNameAr = normalizeText(formData.get("fullNameAr"));
  const fullNameEn = normalizeText(formData.get("fullNameEn"));
  const email = normalizeText(formData.get("email"));
  const phone = normalizeText(formData.get("phone"));
  const organizationName = normalizeText(formData.get("organizationName"));
  const jobTitle = normalizeText(formData.get("jobTitle"));
  const nationalIdOrIqama = normalizeText(formData.get("nationalIdOrIqama"));
  const nominationStatus = normalizeText(
    formData.get("enrollmentStatus"),
  ) as EnrollmentStatus;
  const notes = normalizeText(formData.get("notes"));

  if (!courseRunId || !participantType || !fullNameAr || !nominationStatus) {
    throw new Error("Missing attendee enrollment fields.");
  }

  await trainingService.createAttendeeAndEnroll({
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

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${courseRunId}`);
  redirect(`/trainings/${courseRunId}`);
}

export async function updateEnrollmentStatus(formData: FormData) {
  await requireAuth();

  const nominationId = normalizeText(formData.get("enrollmentId"));
  const courseRunId = normalizeText(formData.get("trainingId"));
  const nominationStatus = normalizeText(
    formData.get("enrollmentStatus"),
  ) as EnrollmentStatus;

  if (!nominationId || !courseRunId || !nominationStatus) {
    throw new Error("Missing enrollment status update fields.");
  }

  await trainingService.updateEnrollmentStatus({
    nominationId,
    courseRunId,
    nominationStatus,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${courseRunId}`);
  redirect(`/trainings/${courseRunId}`);
}

export async function recordAttendance(formData: FormData) {
  await requireAuth();

  const courseRunId = normalizeText(formData.get("trainingId"));
  const participantId = normalizeText(formData.get("attendeeId"));
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

  await trainingService.recordAttendance({
    courseRunId,
    participantId,
    attendanceDate,
    attendanceStatus,
    notes,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${courseRunId}`);
  redirect(`/trainings/${courseRunId}`);
}
