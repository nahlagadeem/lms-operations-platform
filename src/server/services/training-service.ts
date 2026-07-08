import { AttendanceStatus, DeliveryMode, Prisma, TrainingCity } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  AttendeeType,
  EnrollmentStatus,
  TrainingStatus,
} from "@/lib/brd-terminology";
import * as compatibilityService from "@/server/services/course-run-service";

type CreateTrainingInput = {
  purchaseOrderCourseEntryId: string;
  expectedCourseId?: string;
  vendorId?: string;
  vendorCost?: number | null;
  city?: TrainingCity | null;
  daysHeld?: number | null;
  deliveryMode: DeliveryMode;
  status: TrainingStatus;
  startDate: Date | null;
  endDate: Date | null;
  notes: string;
};

type UpdateTrainingInput = {
  trainingId: string;
  purchaseOrderCourseEntryId?: string;
  vendorId: string;
  locationId: string;
  vendorCost?: number | null;
  city?: TrainingCity | null;
  daysHeld?: number | null;
  deliveryMode: DeliveryMode;
  status: TrainingStatus;
  startDate: Date | null;
  endDate: Date | null;
  notes: string;
};

async function resolvePurchaseOrderCourseEntry(
  purchaseOrderCourseEntryId: string,
  expectedCourseId?: string,
) {
  const entry = await db.projectScopeCourse.findUnique({
    where: { id: purchaseOrderCourseEntryId },
    select: {
      id: true,
      scopeId: true,
      courseId: true,
      estimatedSeats: true,
    },
  });

  if (!entry) {
    throw new Error("Selected Purchase Order Course Entry was not found.");
  }

  if (expectedCourseId && entry.courseId !== expectedCourseId) {
    throw new Error("Selected course does not belong to the Purchase Order Course Entry.");
  }

  return entry;
}

async function generateTrainingCode(courseCode: string, startDate: Date | null) {
  const dateToken = (startDate ?? new Date())
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");
  const baseCode = `${courseCode}-${dateToken}`;
  const existing = await db.courseRun.findMany({
    where: { runCode: { startsWith: baseCode } },
    select: { runCode: true },
  });
  const existingCodes = new Set(existing.map((training) => training.runCode));

  if (!existingCodes.has(baseCode)) return baseCode;

  let suffix = 2;
  while (existingCodes.has(`${baseCode}-${String(suffix).padStart(2, "0")}`)) {
    suffix += 1;
  }
  return `${baseCode}-${String(suffix).padStart(2, "0")}`;
}

export async function createTraining(input: CreateTrainingInput) {
  const purchaseOrderCourseEntry = await resolvePurchaseOrderCourseEntry(
    input.purchaseOrderCourseEntryId,
    input.expectedCourseId,
  );
  const course = await db.course.findUnique({
    where: { id: purchaseOrderCourseEntry.courseId },
    select: { courseCode: true, requiresCertificate: true },
  });
  if (!course) throw new Error("Purchase Order Course Entry course was not found.");

  const trainingCode = await generateTrainingCode(course.courseCode, input.startDate);
  return db.courseRun.create({
    data: {
      courseId: purchaseOrderCourseEntry.courseId,
      projectScopeId: purchaseOrderCourseEntry.scopeId,
      projectScopeCourseId: purchaseOrderCourseEntry.id,
      providerId: input.vendorId || null,
      runCode: trainingCode,
      deliveryMode: input.deliveryMode,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      plannedSeats: purchaseOrderCourseEntry.estimatedSeats,
      vendorCost:
        input.vendorCost === null || input.vendorCost === undefined
          ? null
          : new Prisma.Decimal(input.vendorCost),
      city: input.city ?? null,
      daysHeld: input.daysHeld ?? null,
      notes: input.notes || null,
      certificateRequired: course.requiresCertificate,
    },
    select: { id: true, courseId: true },
  });
}

export async function updateTraining(input: UpdateTrainingInput) {
  const purchaseOrderCourseEntry = input.purchaseOrderCourseEntryId
    ? await resolvePurchaseOrderCourseEntry(input.purchaseOrderCourseEntryId)
    : null;

  await db.courseRun.update({
    where: { id: input.trainingId },
    data: {
      ...(purchaseOrderCourseEntry
        ? {
            courseId: purchaseOrderCourseEntry.courseId,
            projectScopeId: purchaseOrderCourseEntry.scopeId,
            projectScopeCourseId: purchaseOrderCourseEntry.id,
            plannedSeats: purchaseOrderCourseEntry.estimatedSeats,
          }
        : {}),
      providerId: input.vendorId || null,
      locationId: input.locationId || null,
      vendorCost:
        input.vendorCost === null || input.vendorCost === undefined
          ? null
          : new Prisma.Decimal(input.vendorCost),
      city: input.city ?? null,
      daysHeld: input.daysHeld ?? null,
      deliveryMode: input.deliveryMode,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      notes: input.notes || null,
    },
  });
}

export async function assignInstructorToTraining(input: {
  trainingId: string;
  instructorId: string;
  role: string;
  isPrimary: boolean;
}) {
  return compatibilityService.assignTrainerToCourseRun({
    courseRunId: input.trainingId,
    trainerId: input.instructorId,
    role: input.role,
    isPrimary: input.isPrimary,
  });
}

export async function removeInstructorFromTraining(trainingId: string, instructorId: string) {
  return compatibilityService.removeTrainerFromCourseRun(trainingId, instructorId);
}

export async function enrollExistingAttendee(input: {
  trainingId: string;
  attendeeId: string;
  enrollmentStatus: EnrollmentStatus;
  notes: string;
}) {
  return compatibilityService.nominateExistingParticipant({
    courseRunId: input.trainingId,
    participantId: input.attendeeId,
    nominationStatus: input.enrollmentStatus,
    notes: input.notes,
  });
}

export async function createAttendeeAndEnroll(input: {
  trainingId: string;
  attendeeType: AttendeeType;
  fullNameAr: string;
  fullNameEn: string;
  email: string;
  phone: string;
  organizationName: string;
  jobTitle: string;
  nationalIdOrIqama: string;
  enrollmentStatus: EnrollmentStatus;
  notes: string;
}) {
  return compatibilityService.createParticipantAndNominate({
    courseRunId: input.trainingId,
    participantType: input.attendeeType,
    fullNameAr: input.fullNameAr,
    fullNameEn: input.fullNameEn,
    email: input.email,
    phone: input.phone,
    organizationName: input.organizationName,
    jobTitle: input.jobTitle,
    nationalIdOrIqama: input.nationalIdOrIqama,
    nominationStatus: input.enrollmentStatus,
    notes: input.notes,
  });
}

export async function updateEnrollmentStatus(input: {
  enrollmentId: string;
  trainingId: string;
  enrollmentStatus: EnrollmentStatus;
  notes?: string;
}) {
  return compatibilityService.updateNominationStatus({
    nominationId: input.enrollmentId,
    courseRunId: input.trainingId,
    nominationStatus: input.enrollmentStatus,
    notes: input.notes,
  });
}

export async function recordAttendance(input: {
  trainingId: string;
  trainingSessionId?: string;
  attendeeId: string;
  attendanceDate?: Date;
  attendanceStatus: AttendanceStatus;
  notes: string;
}) {
  return compatibilityService.recordAttendance({
    courseRunId: input.trainingId,
    trainingSessionId: input.trainingSessionId,
    participantId: input.attendeeId,
    attendanceDate: input.attendanceDate,
    attendanceStatus: input.attendanceStatus,
    notes: input.notes,
  });
}
