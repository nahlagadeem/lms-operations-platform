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
import { db } from "@/lib/db";
import {
  assertPermission,
  canCreateOperationalData,
  canEditOperationalData,
  canManageFinancialFields,
  getCurrentPlatformRole,
} from "@/lib/permissions";
import * as trainingEvaluationService from "@/server/services/training-evaluation-service";
import * as trainingSessionService from "@/server/services/training-session-service";
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

function parseRating(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }
  return parsed;
}

async function requireOperationalAccess() {
  const role = await getCurrentPlatformRole();
  assertPermission(role, canEditOperationalData);
  return role;
}

async function requireOperationalCreationAccess() {
  const role = await getCurrentPlatformRole();
  assertPermission(role, canCreateOperationalData);
  return role;
}

function parseTrainingCity(value: string) {
  return Object.values(TrainingCity).includes(value as TrainingCity)
    ? (value as TrainingCity)
    : null;
}

export async function createTraining(formData: FormData) {
  await requireAuth();
  const role = await requireOperationalCreationAccess();

  const purchaseOrderCourseEntryId = normalizeText(
    formData.get("purchaseOrderCourseEntryId"),
  );
  const expectedCourseId = normalizeText(formData.get("courseId"));
  const vendorId = normalizeText(formData.get("vendorId"));
  const vendorCost = parseOptionalDecimal(normalizeText(formData.get("vendorCost")));
  const city = parseTrainingCity(normalizeText(formData.get("city")));
  const daysHeld = parseOptionalInt(normalizeText(formData.get("daysHeld")));
  const vendorCostValue = normalizeText(formData.get("vendorCost"));
  const deliveryMode = normalizeText(formData.get("deliveryMode")) as DeliveryMode;
  const status = normalizeText(formData.get("status")) as TrainingStatus;
  const startDate = parseOptionalDate(normalizeText(formData.get("startDate")));
  const endDate = parseOptionalDate(normalizeText(formData.get("endDate")));
  const notes = normalizeText(formData.get("notes"));

  if (!purchaseOrderCourseEntryId || !deliveryMode || !status) {
    throw new Error("Please choose a PO Course Entry and try again.");
  }

  if (vendorCostValue && !canManageFinancialFields(role)) {
    throw new Error("You are not allowed to modify financial fields.");
  }

  const createdTraining = await trainingService.createTraining({
    purchaseOrderCourseEntryId,
    expectedCourseId: expectedCourseId || undefined,
    vendorId: vendorId || undefined,
      vendorCost: vendorCostValue && canManageFinancialFields(role) ? vendorCost : null,
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
  const role = await requireOperationalAccess();
  const canManageFinancials = canManageFinancialFields(role);

  const trainingId = normalizeText(formData.get("trainingId"));
  let purchaseOrderCourseEntryId = normalizeText(
    formData.get("purchaseOrderCourseEntryId"),
  );
  const vendorId = normalizeText(formData.get("vendorId"));
  const submittedVendorCostValue = normalizeText(formData.get("vendorCost"));
  const submittedVendorCost = parseOptionalDecimal(submittedVendorCostValue);
  const city = parseTrainingCity(normalizeText(formData.get("city")));
  const daysHeld = parseOptionalInt(normalizeText(formData.get("daysHeld")));
  const locationId = normalizeText(formData.get("locationId"));
  const deliveryMode = normalizeText(formData.get("deliveryMode")) as DeliveryMode;
  const status = normalizeText(formData.get("status")) as TrainingStatus;
  const startDate = parseOptionalDate(normalizeText(formData.get("startDate")));
  const endDate = parseOptionalDate(normalizeText(formData.get("endDate")));
  const notes = normalizeText(formData.get("notes"));

  if (!trainingId || !deliveryMode || !status) {
    throw new Error("Please complete the required training details.");
  }

  const existingTraining = await db.courseRun.findUnique({
    where: { id: trainingId },
    select: { vendorCost: true, projectScopeCourseId: true },
  });

  if (!existingTraining) {
    throw new Error("Training was not found.");
  }

  purchaseOrderCourseEntryId =
    purchaseOrderCourseEntryId || existingTraining.projectScopeCourseId || "";

  if (!purchaseOrderCourseEntryId) {
    throw new Error("Training is missing its PO Course Entry.");
  }

  const vendorCost = canManageFinancials
    ? submittedVendorCost
    : existingTraining.vendorCost === null
      ? null
      : Number(existingTraining.vendorCost);

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
  await requireOperationalAccess();

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
  await requireOperationalAccess();

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

export async function createTrainingSession(formData: FormData) {
  await requireAuth();
  await requireOperationalAccess();

  const trainingId = normalizeText(formData.get("trainingId"));
  const sessionDate = parseOptionalDate(normalizeText(formData.get("sessionDate")));
  const notes = normalizeText(formData.get("notes"));

  if (!trainingId || !sessionDate) {
    throw new Error("Missing training session fields.");
  }

  await trainingSessionService.createTrainingSession({
    courseRunId: trainingId,
    sessionDate,
    notes,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${trainingId}`);
  redirect(`/trainings/${trainingId}`);
}

export async function updateTrainingSession(formData: FormData) {
  await requireAuth();
  await requireOperationalAccess();

  const trainingId = normalizeText(formData.get("trainingId"));
  const sessionId = normalizeText(formData.get("sessionId"));
  const sessionDate = parseOptionalDate(normalizeText(formData.get("sessionDate")));
  const notes = normalizeText(formData.get("notes"));

  if (!trainingId || !sessionId || !sessionDate) {
    throw new Error("Missing training session update fields.");
  }

  await trainingSessionService.updateTrainingSession({
    sessionId,
    courseRunId: trainingId,
    sessionDate,
    notes,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${trainingId}`);
  redirect(`/trainings/${trainingId}`);
}

export async function enrollExistingAttendee(formData: FormData) {
  await requireAuth();
  await requireOperationalAccess();

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
  await requireOperationalAccess();

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
  await requireOperationalAccess();

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
  await requireOperationalAccess();

  const trainingId = normalizeText(formData.get("trainingId"));
  const trainingSessionId = normalizeText(formData.get("trainingSessionId"));
  const attendeeId = normalizeText(formData.get("attendeeId"));
  const attendanceDateValue = normalizeText(formData.get("attendanceDate"));
  const attendanceStatus = normalizeText(
    formData.get("attendanceStatus"),
  ) as AttendanceStatus;
  const notes = normalizeText(formData.get("notes"));

  if (!trainingId || !attendeeId || !attendanceStatus) {
    throw new Error("Missing attendance fields.");
  }

  const parsedAttendanceDate = trainingSessionId
    ? null
    : parseOptionalDate(attendanceDateValue);

  if (!trainingSessionId && !parsedAttendanceDate) {
    throw new Error("Attendance date is invalid.");
  }

  const attendanceDate = parsedAttendanceDate ?? undefined;

  await trainingService.recordAttendance({
    trainingId,
    trainingSessionId: trainingSessionId || undefined,
    attendeeId,
    attendanceDate,
    attendanceStatus,
    notes,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${trainingId}`);
  redirect(`/trainings/${trainingId}`);
}

export async function upsertCourseEvaluation(formData: FormData) {
  await requireAuth();
  await requireOperationalAccess();

  const trainingId = normalizeText(formData.get("trainingId"));
  const attendeeId = normalizeText(formData.get("attendeeId"));
  const rating = parseRating(normalizeText(formData.get("rating")));
  const comments = normalizeText(formData.get("comments"));

  if (!trainingId || !attendeeId) {
    throw new Error("Missing course evaluation fields.");
  }

  await trainingEvaluationService.upsertCourseEvaluation({
    courseRunId: trainingId,
    participantId: attendeeId,
    rating,
    comments,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${trainingId}`);
  redirect(`/trainings/${trainingId}`);
}

export async function upsertInstructorEvaluation(formData: FormData) {
  await requireAuth();
  await requireOperationalAccess();

  const trainingId = normalizeText(formData.get("trainingId"));
  const attendeeId = normalizeText(formData.get("attendeeId"));
  const subjectInstructorId = normalizeText(formData.get("subjectInstructorId"));
  const rating = parseRating(normalizeText(formData.get("rating")));
  const comments = normalizeText(formData.get("comments"));

  if (!trainingId || !attendeeId || !subjectInstructorId) {
    throw new Error("Missing instructor evaluation fields.");
  }

  await trainingEvaluationService.upsertInstructorEvaluation({
    courseRunId: trainingId,
    participantId: attendeeId,
    subjectInstructorId,
    rating,
    comments,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${trainingId}`);
  redirect(`/trainings/${trainingId}`);
}

export async function upsertAttendeeEvaluation(formData: FormData) {
  await requireAuth();
  await requireOperationalAccess();

  const trainingId = normalizeText(formData.get("trainingId"));
  const attendeeId = normalizeText(formData.get("attendeeId"));
  const evaluatorInstructorId = normalizeText(formData.get("evaluatorInstructorId"));
  const rating = parseRating(normalizeText(formData.get("rating")));
  const comments = normalizeText(formData.get("comments"));

  if (!trainingId || !attendeeId || !evaluatorInstructorId) {
    throw new Error("Missing attendee evaluation fields.");
  }

  await trainingEvaluationService.upsertAttendeeEvaluation({
    courseRunId: trainingId,
    participantId: attendeeId,
    evaluatorInstructorId,
    rating,
    comments,
  });

  revalidatePath("/trainings");
  revalidatePath(`/trainings/${trainingId}`);
  redirect(`/trainings/${trainingId}`);
}
