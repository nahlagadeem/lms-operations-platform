"use server";

import {
  AttendanceStatus,
  DeliveryMode,
  TrainingCity,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { AttendeeType, EnrollmentStatus, TrainingStatus } from "@/lib/brd-terminology";
import * as trainingService from "@/server/services/training-service";

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalDecimal(value: string) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInt(value: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseTrainingCity(value: string) {
  return Object.values(TrainingCity).includes(value as TrainingCity)
    ? (value as TrainingCity)
    : null;
}

export async function createTraining(formData: FormData) {
  await requireAuth();

  const purchaseOrderCourseEntryId = normalizeText(
    formData.get("purchaseOrderCourseEntryId"),
  );
  const expectedCourseId = normalizeText(formData.get("courseId"));
  const vendorId = normalizeText(formData.get("vendorId"));
  const vendorCost = parseOptionalDecimal(normalizeText(formData.get("vendorCost")));
  const city = parseTrainingCity(normalizeText(formData.get("city")));
  const daysHeld = parseOptionalInt(normalizeText(formData.get("daysHeld")));
  const deliveryMode = normalizeText(formData.get("deliveryMode")) as DeliveryMode;
  const status = normalizeText(formData.get("status")) as TrainingStatus;
  const startDate = parseOptionalDate(normalizeText(formData.get("startDate")));
  const endDate = parseOptionalDate(normalizeText(formData.get("endDate")));
  const notes = normalizeText(formData.get("notes"));

  if (!purchaseOrderCourseEntryId || !deliveryMode || !status) {
    throw new Error("Please choose a PO Course Entry and try again.");
  }

  const createdTraining = await trainingService.createTraining({
    purchaseOrderCourseEntryId,
    expectedCourseId: expectedCourseId || undefined,
    vendorId: vendorId || undefined,
    vendorCost,
    city,
    daysHeld,
    deliveryMode,
    status,
    startDate,
    endDate,
    notes,
  });

  revalidatePath(`/courses/${createdTraining.courseId}`);
  revalidatePath("/pos");
  revalidatePath("/trainings");
  redirect(`/trainings/${createdTraining.id}`);
}

export async function updateTraining(formData: FormData) {
  await requireAuth();

  const trainingId = normalizeText(formData.get("trainingId"));
  const purchaseOrderCourseEntryId = normalizeText(
    formData.get("purchaseOrderCourseEntryId"),
  );
  const vendorId = normalizeText(formData.get("vendorId"));
  const vendorCost = parseOptionalDecimal(normalizeText(formData.get("vendorCost")));
  const city = parseTrainingCity(normalizeText(formData.get("city")));
  const daysHeld = parseOptionalInt(normalizeText(formData.get("daysHeld")));
  const locationId = normalizeText(formData.get("locationId"));
  const deliveryMode = normalizeText(formData.get("deliveryMode")) as DeliveryMode;
  const status = normalizeText(formData.get("status")) as TrainingStatus;
  const startDate = parseOptionalDate(normalizeText(formData.get("startDate")));
  const endDate = parseOptionalDate(normalizeText(formData.get("endDate")));
  const notes = normalizeText(formData.get("notes"));

  if (!trainingId || !purchaseOrderCourseEntryId || !deliveryMode || !status) {
    throw new Error("Please complete the required training details.");
  }

  await trainingService.updateTraining({
    trainingId,
    purchaseOrderCourseEntryId,
    vendorId,
    locationId,
    vendorCost,
    city,
    daysHeld,
    deliveryMode,
    status,
    startDate,
    endDate,
    notes,
  });

  revalidatePath("/pos");
  revalidatePath("/trainings");
  revalidatePath(`/trainings/${trainingId}`);
  redirect(`/trainings/${trainingId}`);
}

export async function assignInstructorToTraining(formData: FormData) {
  await requireAuth();

  const trainingId = normalizeText(formData.get("trainingId"));
  const instructorId = normalizeText(formData.get("instructorId"));
  const role = normalizeText(formData.get("role"));
  const isPrimary = normalizeText(formData.get("isPrimary")) === "true";

  if (!trainingId || !instructorId) {
    throw new Error("Missing instructor assignment fields.");
  }

  await trainingService.assignInstructorToTraining({
    trainingId,
    instructorId,
    role,
    isPrimary,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${trainingId}`);
  redirect(`/trainings/${trainingId}`);
}

export async function removeInstructorFromTraining(formData: FormData) {
  await requireAuth();

  const trainingId = normalizeText(formData.get("trainingId"));
  const instructorId = normalizeText(formData.get("instructorId"));

  if (!trainingId || !instructorId) {
    throw new Error("Missing instructor removal fields.");
  }

  await trainingService.removeInstructorFromTraining(trainingId, instructorId);

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${trainingId}`);
  redirect(`/trainings/${trainingId}`);
}

export async function enrollExistingAttendee(formData: FormData) {
  await requireAuth();

  const trainingId = normalizeText(formData.get("trainingId"));
  const attendeeId = normalizeText(formData.get("attendeeId"));
  const enrollmentStatus = normalizeText(
    formData.get("enrollmentStatus"),
  ) as EnrollmentStatus;
  const notes = normalizeText(formData.get("notes"));

  if (!trainingId || !attendeeId || !enrollmentStatus) {
    throw new Error("Missing enrollment fields.");
  }

  await trainingService.enrollExistingAttendee({
    trainingId,
    attendeeId,
    enrollmentStatus,
    notes,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${trainingId}`);
  redirect(`/trainings/${trainingId}`);
}

export async function createAttendeeAndEnroll(formData: FormData) {
  await requireAuth();

  const trainingId = normalizeText(formData.get("trainingId"));
  const attendeeType = normalizeText(
    formData.get("attendeeType"),
  ) as AttendeeType;
  const fullNameAr = normalizeText(formData.get("fullNameAr"));
  const fullNameEn = normalizeText(formData.get("fullNameEn"));
  const email = normalizeText(formData.get("email"));
  const phone = normalizeText(formData.get("phone"));
  const organizationName = normalizeText(formData.get("organizationName"));
  const jobTitle = normalizeText(formData.get("jobTitle"));
  const nationalIdOrIqama = normalizeText(formData.get("nationalIdOrIqama"));
  const enrollmentStatus = normalizeText(
    formData.get("enrollmentStatus"),
  ) as EnrollmentStatus;
  const notes = normalizeText(formData.get("notes"));

  if (!trainingId || !attendeeType || !fullNameAr || !enrollmentStatus) {
    throw new Error("Missing attendee enrollment fields.");
  }

  await trainingService.createAttendeeAndEnroll({
    trainingId,
    attendeeType,
    fullNameAr,
    fullNameEn,
    email,
    phone,
    organizationName,
    jobTitle,
    nationalIdOrIqama,
    enrollmentStatus,
    notes,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${trainingId}`);
  redirect(`/trainings/${trainingId}`);
}

export async function updateEnrollmentStatus(formData: FormData) {
  await requireAuth();

  const enrollmentId = normalizeText(formData.get("enrollmentId"));
  const trainingId = normalizeText(formData.get("trainingId"));
  const enrollmentStatus = normalizeText(
    formData.get("enrollmentStatus"),
  ) as EnrollmentStatus;
  const notes = normalizeText(formData.get("notes"));

  if (!enrollmentId || !trainingId || !enrollmentStatus) {
    throw new Error("Missing enrollment status update fields.");
  }

  await trainingService.updateEnrollmentStatus({
    enrollmentId,
    trainingId,
    enrollmentStatus,
    notes,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${trainingId}`);
  redirect(`/trainings/${trainingId}`);
}

export async function recordAttendance(formData: FormData) {
  await requireAuth();

  const trainingId = normalizeText(formData.get("trainingId"));
  const attendeeId = normalizeText(formData.get("attendeeId"));
  const attendanceDateValue = normalizeText(formData.get("attendanceDate"));
  const attendanceStatus = normalizeText(
    formData.get("attendanceStatus"),
  ) as AttendanceStatus;
  const notes = normalizeText(formData.get("notes"));

  if (!trainingId || !attendeeId || !attendanceDateValue || !attendanceStatus) {
    throw new Error("Missing attendance fields.");
  }

  const attendanceDate = parseOptionalDate(attendanceDateValue);

  if (!attendanceDate) {
    throw new Error("Attendance date is invalid.");
  }

  await trainingService.recordAttendance({
    trainingId,
    attendeeId,
    attendanceDate,
    attendanceStatus,
    notes,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${trainingId}`);
  redirect(`/trainings/${trainingId}`);
}
